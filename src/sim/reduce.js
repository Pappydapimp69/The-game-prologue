// reduce(state, command) is the ONLY thing that mutates authoritative state.
// It returns an array of events for the presentation layer to consume; the
// renderer reads state and never writes it.
//
// Contract notes (permanent):
// - Commands target entities by stable id, never by position or index.
// - Dodge i-frames are the RENDERER withholding ENEMY_STRIKE for the window —
//   there is no "invulnerable" flag in authoritative state.
// - Enemy aggression is its own command (ENEMY_STRIKE), issued by the
//   presentation layer's AI driver, so the sim stays a pure reducer.
// - Quests are offered, never pushed: TALK emits an offer; only ACCEPT_QUEST
//   activates it. Declining costs nothing and the offer stays available.

import { nextInt } from './rng.js';
import { isNight } from './daynight.js';

const MELEE_RANGE = 1;   // Chebyshev tiles
const BLAST_RANGE = 3;
const BLAST_COST = 3;
const XP_PER_LEVEL = 5;  // lvl N -> N+1 costs N*XP_PER_LEVEL
const RESPAWN_DELAY_TICKS = 10; // ~5s at TICK_MS=500 — a beat, not instant

// Charge is press-and-hold, not tap-spam: the presentation dispatches one
// CHARGE per fixed real-time tick while the button stays down (start:true on
// the frame the hold begins, resetting the ramp). Rate = a mild ramp with
// hold duration, reshaped by CURRENT aura fill: fast from empty, throttled
// hard above the 80% mark regardless of how long the hold has run.
const CHARGE_RAMP_STEP = 4;  // every N consecutive ticks held...
const CHARGE_RAMP_CAP = 8;   // ...up to this many ticks of bonus
const CHARGE_TOP_PCT = 80;   // aura % at/above which charging is throttled

export function reduce(state, command) {
  const events = reduceCore(state, command);
  arcObserve(state, events);
  questRespawnObserve(state, events);
  return events;
}

function reduceCore(state, command) {
  switch (command.type) {
    case 'TICK': {
      state.tick += 1;
      return [];
    }

    case 'MOVE': {
      const { dx, dy } = command;
      if (!Number.isInteger(dx) || !Number.isInteger(dy)) throw new Error('MOVE: dx/dy must be integers');
      const nx = clamp(state.player.x + clamp(dx, -1, 1), 0, state.region.w - 1);
      const ny = clamp(state.player.y + clamp(dy, -1, 1), 0, state.region.h - 1);
      if (state.region.blocked[`${nx},${ny}`]) return [{ type: 'blocked', x: nx, y: ny }];
      state.player.x = nx;
      state.player.y = ny;
      const events = [{ type: 'moved', x: nx, y: ny }];
      questProgress(state, events, 'reach', null);
      // The eastern gate is the region's authoritative exit: locked until the
      // opening arc is complete, the prologue's ending when it isn't.
      const gate = state.region.zones['east-gate'];
      if (gate && Math.max(Math.abs(nx - gate.x), Math.abs(ny - gate.y)) <= gate.r) {
        if (state.arc.complete && !state.flags.ended) {
          state.flags.ended = 1;
          events.push({ type: 'prologue_complete' });
        } else if (!state.arc.complete) {
          events.push({ type: 'exit_locked' });
        }
      }
      return events;
    }

    case 'TALK': {
      const npc = state.npcs[command.npcId];
      if (!npc) throw new Error(`TALK: no npc ${command.npcId}`);
      if (dist(state.player, npc) > 1) return [{ type: 'too_far', target: command.npcId }];
      const events = [{ type: 'talked', npc: command.npcId }];
      const q = npc.offers;
      if (q && !state.quests.active[q] && !state.quests.completed[q]) {
        state.quests.offered[q] = 1;
        events.push({ type: 'quest_offered', quest: q });
      }
      return events;
    }

    case 'ACCEPT_QUEST': {
      const q = command.questId;
      if (!state.quests.offered[q]) throw new Error(`ACCEPT_QUEST: ${q} not offered`);
      const def = state.quests.defs[q];
      delete state.quests.offered[q];
      // respawnAt is parallel to progress/objectives (0 = no respawn
      // pending) — see questRespawnObserve below, the kill-objective safety
      // net that keeps a quest from stalling if its unlocked targets are
      // all dead before the objective is satisfied.
      state.quests.active[q] = {
        progress: def.objectives.map(() => 0),
        respawnAt: def.objectives.map(() => 0),
      };
      const events = [{ type: 'quest_accepted', quest: q }];
      // Unlock entities on accept — never before. Nothing this quest needs
      // existed until now, so completion never depends on prior actions.
      if (def.unlocks) {
        for (const [id, tmpl] of Object.entries(def.unlocks.enemies || {})) {
          state.enemies[id] = { ...tmpl };
          events.push({ type: 'enemy_appeared', target: id, kind: tmpl.kind });
        }
        for (const [id, tmpl] of Object.entries(def.unlocks.pickups || {})) {
          state.pickups[id] = { ...tmpl };
          events.push({ type: 'pickup_appeared', target: id, item: tmpl.item });
        }
      }
      return events;
    }

    case 'INTERACT': {
      const p = state.pickups[command.pickupId];
      if (!p) throw new Error(`INTERACT: no pickup ${command.pickupId}`);
      if (p.taken) return [{ type: 'nothing_there', target: command.pickupId }];
      if (dist(state.player, p) > 1) return [{ type: 'too_far', target: command.pickupId }];
      p.taken = 1; // deactivate the one-shot the instant it's taken
      state.player.inventory.push(p.item);
      const events = [{ type: 'picked_up', item: p.item }];
      questProgress(state, events, 'collect', p.item);
      return events;
    }

    case 'BREAK': {
      const d = state.destructibles[command.destructibleId];
      if (!d) throw new Error(`BREAK: no destructible ${command.destructibleId}`);
      if (d.broken) return [{ type: 'nothing_there', target: command.destructibleId }];
      if (dist(state.player, d) > 1) return [{ type: 'too_far', target: command.destructibleId }];
      d.broken = 1;
      state.player.coins += d.coins;
      return [{ type: 'broke', target: command.destructibleId, coins: d.coins }];
    }

    case 'MELEE': {
      const e = livingEnemy(state, command.enemyId, 'MELEE');
      if (typeof e === 'object' && e.type) return [e];
      if (dist(state.player, e) > MELEE_RANGE) return [{ type: 'too_far', target: command.enemyId }];
      const dmg = state.player.skills.melee.lvl + 1 + nextInt(state.rng, 4);
      const events = hitEnemy(state, command.enemyId, e, dmg, 'melee');
      gainXp(state, events, 'melee');
      return events;
    }

    case 'CHARGE': {
      const p = state.player;
      if (command.start) p.chargeHold = 0;
      const hold = p.chargeHold;
      const pct = p.maxAura > 0 ? Math.floor((p.aura * 100) / p.maxAura) : 100;

      let gain;
      if (pct >= CHARGE_TOP_PCT) {
        // Throttled near the cap — half the base rate, ignoring the ramp
        // entirely: "slower after 80%, regardless of how long held."
        gain = hold % 2 === 0 ? 1 : 0;
      } else {
        gain = 1 + Math.floor(Math.min(hold, CHARGE_RAMP_CAP) / CHARGE_RAMP_STEP);
        if (pct <= 0) gain += 1; // fills fastest from empty
      }

      p.aura = Math.min(p.maxAura, p.aura + gain);
      p.chargeHold = hold + 1;
      return [{ type: 'charged', aura: p.aura, gain }];
    }

    case 'AURA_BLAST': {
      const e = livingEnemy(state, command.enemyId, 'AURA_BLAST');
      if (typeof e === 'object' && e.type) return [e];
      if (dist(state.player, e) > BLAST_RANGE) return [{ type: 'too_far', target: command.enemyId }];
      if (state.player.aura < BLAST_COST) return [{ type: 'no_aura', need: BLAST_COST }];
      state.player.aura -= BLAST_COST;
      const dmg = state.player.skills.aura.lvl + 2 + nextInt(state.rng, 6);
      const events = hitEnemy(state, command.enemyId, e, dmg, 'aura');
      gainXp(state, events, 'aura');
      return events;
    }

    case 'ALLY_STRIKE': {
      // The mentor fights beside you in the boss's first phase. Like enemy
      // aggression, ally aggression is a command from the presentation's AI
      // driver — and it stops the moment the mentor falls.
      if (!state.arc.bossSpawned || state.arc.mentorDown) return [{ type: 'not_now' }];
      const e = livingEnemy(state, command.enemyId, 'ALLY_STRIKE');
      if (typeof e === 'object' && e.type) return [e];
      const dmg = 3 + nextInt(state.rng, 3);
      return hitEnemy(state, command.enemyId, e, dmg, 'ally');
    }

    case 'CHOOSE_FATE': {
      // The prologue's one real choice — it travels into the saga export.
      if (!state.arc.bossDefeated || state.arc.complete) return [{ type: 'not_now' }];
      if (command.fate !== 'spare' && command.fate !== 'finish') {
        throw new Error(`CHOOSE_FATE: bad fate ${command.fate}`);
      }
      state.arc.choice = command.fate;
      state.arc.complete = 1;
      return [{ type: 'arc_complete', choice: command.fate }];
    }

    case 'ENEMY_STRIKE': {
      const e = livingEnemy(state, command.enemyId, 'ENEMY_STRIKE');
      if (typeof e === 'object' && e.type) return [e];
      if (dist(state.player, e) > MELEE_RANGE) return [{ type: 'too_far', target: command.enemyId }];
      // Difficulty is a SETTING, not a decision — both tones ship (gentle is
      // the prologue default; harsh raises every enemy hit by 1). Night
      // stacks its own +1: the clock is pressure, not paint.
      const dmg = e.power + nextInt(state.rng, 3)
        + (state.settings.difficulty === 'harsh' ? 1 : 0)
        + (isNight(state.tick) ? 1 : 0);
      state.player.hp = Math.max(0, state.player.hp - dmg);
      const events = [{ type: 'player_hit', by: command.enemyId, dmg, hp: state.player.hp }];
      if (state.player.hp === 0) events.push({ type: 'player_defeated' });
      return events;
    }

    case 'BUY': {
      const item = state.items[command.itemId];
      if (!item) throw new Error(`BUY: no item ${command.itemId}`);
      if (item.price === undefined) return [{ type: 'not_for_sale', item: command.itemId }];
      if (state.player.coins < item.price) return [{ type: 'cant_afford', item: command.itemId }];
      state.player.coins -= item.price;
      state.player.inventory.push(command.itemId);
      return [{ type: 'bought', item: command.itemId, coins: state.player.coins }];
    }

    case 'USE_ITEM': {
      const idx = state.player.inventory.indexOf(command.itemId);
      if (idx === -1) return [{ type: 'no_item', item: command.itemId }];
      const item = state.items[command.itemId];
      if (!item || !item.heal) return [{ type: 'cant_use', item: command.itemId }];
      state.player.inventory.splice(idx, 1);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + item.heal);
      return [{ type: 'healed', hp: state.player.hp }];
    }

    default:
      throw new Error(`reduce: unknown command ${command.type}`);
  }
}

// Runs a command stream. Test/replay helper.
export function replay(state, commands) {
  const events = [];
  for (const c of commands) events.push(...reduce(state, c));
  return events;
}

// --- internals -------------------------------------------------------------

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

function livingEnemy(state, id, cmd) {
  const e = state.enemies[id];
  if (!e) throw new Error(`${cmd}: no enemy ${id}`);
  if (!e.alive) return { type: 'already_down', target: id };
  return e;
}

function hitEnemy(state, id, e, dmg, kind) {
  e.hp = Math.max(0, e.hp - dmg);
  const events = [{ type: 'enemy_hit', target: id, kind, dmg, hp: e.hp }];
  if (e.hp === 0) {
    e.alive = 0;
    state.player.coins += 2;
    events.push({ type: 'enemy_defeated', target: id, kind: e.kind });
    questProgress(state, events, 'kill', e.kind);
  }
  return events;
}

// Use-based growth: the skill you exercise is the skill that levels.
function gainXp(state, events, skillName) {
  const s = state.player.skills[skillName];
  s.xp += 1;
  if (s.xp >= s.lvl * XP_PER_LEVEL) {
    s.xp = 0;
    s.lvl += 1;
    events.push({ type: 'skill_up', skill: skillName, lvl: s.lvl });
  }
}

// The opening arc observes the events of every command — it never intercepts
// them. Steps map NARROWLY: the training crate completes `crate`; a future
// destructible objective won't. (Tutorial objects must not satisfy later
// quests, and vice versa.)
function arcObserve(state, events) {
  const arc = state.arc;
  if (!arc || state.flags.ended) return;
  const s = arc.steps;

  for (const e of events) {
    switch (e.type) {
      case 'moved': {
        arc.moveCount += 1;
        if (arc.moveCount >= 5) s.move = 1;
        const z = state.region.zones['east-pass'];
        if (z && Math.max(Math.abs(e.x - z.x), Math.abs(e.y - z.y)) <= z.r) s.pass = 1;
        break;
      }
      case 'talked': if (e.npc === 'warden') s.talk = 1; break;
      case 'quest_accepted': if (e.quest === 'clear-the-road') s.quest = 1; break;
      case 'picked_up': if (e.item === 'training-capsule') s.capsule = 1; break;
      case 'broke': if (e.target === 'crate1') s.crate = 1; break;
      case 'enemy_hit':
        if (e.kind === 'melee') s.melee = 1;
        if (e.kind === 'aura') s.aura = 1;
        break;
      case 'bought': if (e.item === 'tonic') s.tonic = 1; break;
      case 'enemy_defeated':
        if (e.target === arc.bossDef.id) arc.bossDefeated = 1;
        break;
    }
  }

  // Every teaching step done → the finale begins: the boss crests the pass
  // and the mentor moves to hold the line beside you.
  if (!arc.bossSpawned && Object.values(s).every((v) => v === 1)) {
    const b = arc.bossDef;
    if (!state.enemies[b.id]) { // never respawn
      state.enemies[b.id] = {
        x: b.x, y: b.y, kind: b.kind,
        hp: b.hp, maxHp: b.hp, power: b.power, alive: 1,
      };
      state.npcs.warden.x = b.x - 1;
      state.npcs.warden.y = b.y - 1;
      arc.bossSpawned = 1;
      events.push({ type: 'boss_appeared', boss: b.id });
    }
  }

  // Phase two: at half health the Ravager lashes out — the mentor falls, and
  // the fight is yours alone.
  if (arc.bossSpawned && !arc.mentorDown) {
    const boss = state.enemies[arc.bossDef.id];
    if (boss && boss.alive && boss.hp <= Math.floor(boss.maxHp / 2)) {
      arc.mentorDown = 1;
      events.push({ type: 'mentor_fallen' });
    }
  }
}

// Safety net for `kill` objectives: a quest's unlocked enemies are a FIXED
// batch (ACCEPT_QUEST spawns them once, nothing else respawns them), so a
// player who kills all of them by any method other than the one that
// finishes the objective would otherwise stall the quest forever with no
// targets left. While a quest is active, its kill objective isn't yet
// satisfied, and every enemy the quest unlocked of that objective's target
// kind is dead, a fresh copy of the template reappears after a short delay
// (state.tick-gated, like arc.moveCount/isNight — no wall-clock, no RNG).
// Scoped narrowly: only touches `kill` objectives' own unlocked entities,
// never the boss, the arc's teaching steps, or collect/reach objectives.
// Stops the moment the objective is satisfied.
function questRespawnObserve(state, events) {
  for (const qId of Object.keys(state.quests.active)) {
    const def = state.quests.defs[qId];
    const st = state.quests.active[qId];
    // Saves made before this safety net existed (same WORLD_VERSION, quest
    // already active) won't have respawnAt — backfill it rather than bump
    // the save schema over a purely additive, zero-initialized field.
    if (!st.respawnAt) st.respawnAt = def.objectives.map(() => 0);
    const unlocked = def.unlocks && def.unlocks.enemies;
    if (!unlocked) continue;
    const ids = Object.keys(unlocked);
    if (!ids.length) continue;

    def.objectives.forEach((obj, i) => {
      if (obj.type !== 'kill') return;
      const need = obj.n || 1;
      if (st.progress[i] >= need) { st.respawnAt[i] = 0; return; } // done — no more insurance needed
      const targets = ids.filter((id) => unlocked[id].kind === obj.target);
      if (!targets.length) return; // this quest's unlocks don't cover this kill objective
      const anyAlive = targets.some((id) => state.enemies[id] && state.enemies[id].alive);
      if (anyAlive) { st.respawnAt[i] = 0; return; } // still something to fight — no timer running
      if (!st.respawnAt[i]) { st.respawnAt[i] = state.tick + RESPAWN_DELAY_TICKS; return; }
      if (state.tick >= st.respawnAt[i]) {
        const id = targets[0]; // reuse the first unlocked id's template & spot
        state.enemies[id] = { ...unlocked[id] };
        st.respawnAt[i] = 0;
        events.push({ type: 'enemy_appeared', target: id, kind: unlocked[id].kind });
      }
    });
  }
}

// Objective progress for all active quests. Objective types are the
// code/content seam: adding a quest is data; adding a TYPE is a case here.
function questProgress(state, events, type, target) {
  for (const qId of Object.keys(state.quests.active).sort()) {
    const def = state.quests.defs[qId];
    const st = state.quests.active[qId];
    let done = true;
    def.objectives.forEach((obj, i) => {
      if (obj.type === type) {
        const need = obj.n || 1;
        let match = false;
        if (obj.type === 'kill') match = obj.target === target;
        else if (obj.type === 'collect') match = obj.item === target;
        else if (obj.type === 'reach') {
          const z = state.region.zones[obj.zone];
          match = !!z && Math.max(Math.abs(state.player.x - z.x), Math.abs(state.player.y - z.y)) <= z.r;
        }
        if (match && st.progress[i] < need) {
          st.progress[i] += 1;
          events.push({ type: 'objective_progress', quest: qId, objective: i, at: st.progress[i], of: need });
        }
      }
      if (st.progress[i] < (obj.n || 1)) done = false;
    });
    if (done) {
      delete state.quests.active[qId];
      state.quests.completed[qId] = 1;
      state.player.coins += def.reward.coins || 0;
      events.push({ type: 'quest_completed', quest: qId, reward: def.reward });
    }
  }
}
