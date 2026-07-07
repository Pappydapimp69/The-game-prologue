// makeWorld is the ONLY constructor of authoritative state. New Game, tests,
// and save-schema defaults all go through here.
//
// The world is BUILT FROM CONTENT (src/sim/content.js) — definitions are
// copied into state at construction so a running save never shifts under a
// content edit. Authoritative fields are integers only.

import { makeRng } from './rng.js';
import { CONTENT } from './content.js';

export const WORLD_VERSION = 'stage4';

export function makeWorld(seed, options = {}) {
  if (!Number.isInteger(seed)) throw new Error('makeWorld: seed must be an integer');
  const archId = options.archetype || CONTENT.defaultArchetype;
  const arch = CONTENT.archetypes[archId];
  if (!arch) throw new Error(`makeWorld: unknown archetype ${archId}`);
  const difficulty = options.difficulty || 'gentle';
  if (!['gentle', 'harsh'].includes(difficulty)) throw new Error(`makeWorld: bad difficulty ${difficulty}`);

  const regionDef = CONTENT.regions[CONTENT.startRegion];

  const skills = {};
  for (const s of ['melee', 'aura', 'perception']) {
    skills[s] = { lvl: arch.skills[s] || 1, xp: 0 };
  }

  // Quest-gated entities don't exist in the world until their quest is
  // accepted (ACCEPT_QUEST spawns them — see reduce.js) — this makes
  // objectives agnostic of whatever the player did before accepting: there
  // is no "already killed it" case because it didn't exist yet.
  const gatedEnemyIds = new Set(Object.values(CONTENT.quests).flatMap((q) => q.unlocks?.enemies || []));
  const gatedPickupIds = new Set(Object.values(CONTENT.quests).flatMap((q) => q.unlocks?.pickups || []));

  const enemies = {};
  for (const [id, e] of Object.entries(regionDef.enemies)) {
    if (gatedEnemyIds.has(id)) continue;
    const kind = CONTENT.enemyKinds[e.kind];
    enemies[id] = {
      x: e.x, y: e.y, kind: e.kind, hp: kind.hp, maxHp: kind.hp, power: kind.power, alive: 1,
      immune: kind.immune || '', // '' = no immunity, same "no value" convention as arc.choice
    };
  }
  const npcs = {};
  for (const [id, n] of Object.entries(regionDef.npcs)) {
    npcs[id] = { x: n.x, y: n.y, name: n.name };
    if (n.offers) npcs[id].offers = n.offers;
    if (n.shop) npcs[id].shop = [...n.shop];
  }
  const destructibles = {};
  for (const [id, d] of Object.entries(regionDef.destructibles)) {
    destructibles[id] = { x: d.x, y: d.y, broken: 0, coins: d.coins || 0 };
  }
  const pickups = {};
  for (const [id, p] of Object.entries(regionDef.pickups)) {
    if (gatedPickupIds.has(id)) continue;
    pickups[id] = { x: p.x, y: p.y, item: p.item, taken: 0 };
  }
  const blocked = {};
  for (const b of regionDef.blocked) blocked[b] = 1;

  // Quest defs carry their own unlock TEMPLATES (copied from content at
  // construction, like everything else) so reduce.js can spawn them on
  // accept without importing CONTENT — state stays a self-contained copy.
  const questDefs = {};
  for (const [qid, q] of Object.entries(CONTENT.quests)) {
    const def = JSON.parse(JSON.stringify(q));
    if (q.unlocks) {
      def.unlocks = { enemies: {}, pickups: {} };
      for (const id of q.unlocks.enemies || []) {
        const e = regionDef.enemies[id];
        const kind = CONTENT.enemyKinds[e.kind];
        def.unlocks.enemies[id] = {
          x: e.x, y: e.y, kind: e.kind, hp: kind.hp, maxHp: kind.hp, power: kind.power, alive: 1,
          immune: kind.immune || '',
        };
      }
      for (const id of q.unlocks.pickups || []) {
        const p = regionDef.pickups[id];
        def.unlocks.pickups[id] = { x: p.x, y: p.y, item: p.item, taken: 0 };
      }
    }
    questDefs[qid] = def;
  }
  const items = JSON.parse(JSON.stringify(CONTENT.items));

  return {
    version: WORLD_VERSION,
    seed: seed >>> 0,
    tick: 0,
    rng: makeRng(seed >>> 0),
    settings: { difficulty, archetype: archId },
    player: {
      x: regionDef.spawn.x, y: regionDef.spawn.y,
      hp: arch.hp, maxHp: arch.hp,
      aura: 0, maxAura: arch.aura,
      chargeHold: 0, // consecutive CHARGE ticks in the current hold — see reduce.js
      coins: 0,
      skills,
      inventory: [],
    },
    region: {
      id: CONTENT.startRegion,
      w: regionDef.w, h: regionDef.h,
      blocked,
      zones: JSON.parse(JSON.stringify(regionDef.zones || {})),
    },
    npcs,
    enemies,
    destructibles,
    pickups,
    items,
    quests: { defs: questDefs, offered: {}, active: {}, completed: {} },
    // The opening arc: a state overlay that OBSERVES real gameplay events —
    // never a separate tutorial mode. Steps map NARROWLY (the training crate
    // completes `crate`, not any future destructible objective). The boss
    // definition is copied in so the sim stays self-contained.
    arc: {
      steps: {
        move: 0, talk: 0, quest: 0, capsule: 0, crate: 0,
        melee: 0, aura: 0, tonic: 0, pass: 0,
      },
      moveCount: 0,
      bossDef: {
        ...regionDef.boss,
        hp: CONTENT.enemyKinds[regionDef.boss.kind].hp,
        power: CONTENT.enemyKinds[regionDef.boss.kind].power,
        immune: CONTENT.enemyKinds[regionDef.boss.kind].immune || '',
      },
      bossSpawned: 0, mentorDown: 0, bossDefeated: 0,
      choice: '', // '', 'spare', 'finish'
      complete: 0,
    },
    flags: {},
  };
}
