// The presentation-layer orchestrator: owns the ONLY mutable reference to the
// world, translates device-agnostic intents into sim commands, drives enemy
// AI (as ENEMY_STRIKE commands — the sim never acts on its own), and manages
// modals. Modals pause the overworld but never the loop itself; every modal
// dismissal funnels through one closeModal() so no stale flags survive.

import { makeWorld } from '../sim/world.js';
import { reduce } from '../sim/reduce.js';
import { readonly } from './readonly.js';
import { makeInput } from './input.js';
import { render } from './renderer.js';

const MOVE_REPEAT_MS = 140;
const TICK_MS = 500;
const DODGE_MS = 400;       // i-frames = withholding ENEMY_STRIKE this long
const ENEMY_CD_MS = 900;
const MAX_FRAME_MS = 100;   // cap max delta or any stall becomes chaos

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function startGame(canvas, seed) {
  const ctx = canvas.getContext('2d');
  const input = makeInput(canvas);

  let world = makeWorld(seed);
  let ro = readonly(world);
  const view = {
    px: world.player.x, py: world.player.y,
    toasts: [], modal: null, dodging: false, device: 'keyboard',
  };
  let nextMoveAt = 0, nextTickAt = 0, dodgeUntil = 0;
  const enemyCd = {};
  let last = 0;

  function dispatch(cmd) {
    const events = reduce(world, cmd);
    for (const e of events) onEvent(e);
    return events;
  }

  function toast(text) {
    view.toasts.unshift({ text, ttl: 2600 });
    if (view.toasts.length > 4) view.toasts.pop();
  }

  function closeModal() {
    view.modal = null; // single dismissal path — nothing else to restore, by design
  }

  function onEvent(e) {
    switch (e.type) {
      case 'talked': {
        const npc = world.npcs[e.npc];
        if (e.npc === 'keeper') {
          view.modal = {
            kind: 'shop', title: npc.name,
            lines: [`Tonic — heals 5 HP — costs 3 coins. You have ${world.player.coins}.`],
            buttons: [
              { id: 'confirm', label: 'Buy Tonic (Enter)' },
              { id: 'alt', label: 'Drink Tonic (K)' },
              { id: 'cancel', label: 'Leave (Esc)' },
            ],
          };
        } else if (!view.modal) {
          view.modal = {
            kind: 'dialog', title: npc.name,
            lines: ['The road east is crawling with husks.', 'Stay sharp out there.'],
            buttons: [{ id: 'cancel', label: 'Close (Esc)' }],
          };
        }
        break;
      }
      case 'quest_offered': {
        const def = world.quests.defs[e.quest];
        view.modal = {
          kind: 'offer', quest: e.quest, title: `Quest: ${e.quest}`,
          lines: [
            ...def.objectives.map((o) => o.type === 'kill'
              ? `Defeat ${o.n} ${o.target}${o.n > 1 ? 's' : ''}`
              : `Find the ${o.item}`),
            `Reward: ${def.reward.coins} coins`,
            'No pressure — the offer stands if you walk away.',
          ],
          buttons: [
            { id: 'confirm', label: 'Accept (Enter)' },
            { id: 'cancel', label: 'Later (Esc)' },
          ],
        };
        break;
      }
      case 'picked_up': toast(`Picked up ${e.item}`); break;
      case 'broke': toast(`Crate smashed — +${e.coins} coins`); break;
      case 'enemy_hit': toast(`Hit for ${e.dmg}`); break;
      case 'enemy_defeated': toast(`${e.kind} defeated!`); break;
      case 'player_hit': toast(`Took ${e.dmg} damage`); break;
      case 'skill_up': toast(`${e.skill} rose to ${e.lvl}!`); break;
      case 'objective_progress': toast(`${e.quest}: ${e.at}/${e.of}`); break;
      case 'quest_completed': toast(`Quest complete! +${e.reward.coins} coins`); break;
      case 'healed': toast(`Recovered — HP ${e.hp}`); break;
      case 'bought': toast(`Bought — ${e.coins} coins left`); break;
      case 'no_aura': toast('Not enough aura — Charge first'); break;
      case 'too_far': toast('Too far away'); break;
      case 'cant_afford': toast('Not enough coins'); break;
      case 'no_item': toast('Nothing to drink'); break;
      case 'player_defeated':
        view.modal = {
          kind: 'defeat', title: 'You fall...',
          lines: ['The vale goes quiet.'],
          buttons: [{ id: 'confirm', label: 'Rise Again (Enter)' }],
        };
        break;
    }
  }

  // Nearest living/available entity of a kind within range.
  function nearest(map, range, ok = () => true) {
    let best = null, bestD = range + 1;
    for (const id of Object.keys(map).sort()) {
      const e = map[id];
      if (!ok(e)) continue;
      const d = dist(world.player, e);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  function handleModal(presses) {
    const m = view.modal;
    if (presses.confirm || (m.kind !== 'shop' && presses.interact)) {
      if (m.kind === 'offer') { dispatch({ type: 'ACCEPT_QUEST', questId: m.quest }); closeModal(); toast('Quest accepted'); }
      else if (m.kind === 'shop') { dispatch({ type: 'BUY', itemId: 'tonic' }); }
      else if (m.kind === 'defeat') { world = makeWorld(seed); ro = readonly(world); closeModal(); toast('A new dawn'); }
      else closeModal();
      return;
    }
    if (presses.alt || presses.blast) {
      if (m.kind === 'shop') dispatch({ type: 'USE_ITEM', itemId: 'tonic' });
      return;
    }
    if (presses.cancel || presses.dodge) closeModal();
  }

  function handleWorld(now, move, presses) {
    if (presses.dodge) { dodgeUntil = now + DODGE_MS; toast('Dodge!'); }

    if (move.dx || move.dy) {
      if (now >= nextMoveAt) {
        dispatch({ type: 'MOVE', dx: move.dx, dy: move.dy });
        nextMoveAt = now + MOVE_REPEAT_MS;
      }
    } else {
      nextMoveAt = 0; // released: next press moves instantly
    }

    if (presses.attack) {
      const id = nearest(world.enemies, 1, (e) => e.alive);
      if (id) dispatch({ type: 'MELEE', enemyId: id });
      else toast('No enemy in reach');
    }
    if (presses.blast) {
      const id = nearest(world.enemies, 3, (e) => e.alive);
      if (id) dispatch({ type: 'AURA_BLAST', enemyId: id });
      else toast('No enemy in range');
    }
    if (presses.charge) dispatch({ type: 'CHARGE' });
    if (presses.interact) {
      const npcId = nearest(world.npcs, 1);
      const pickId = nearest(world.pickups, 1, (p) => !p.taken);
      const crateId = nearest(world.destructibles, 1, (d) => !d.broken);
      if (npcId) dispatch({ type: 'TALK', npcId });
      else if (pickId) dispatch({ type: 'INTERACT', pickupId: pickId });
      else if (crateId) dispatch({ type: 'BREAK', destructibleId: crateId });
      else toast('Nothing here');
    }

    // Enemy AI: adjacent living enemies strike on cooldown — unless the
    // player is inside the dodge window (that withholding IS the i-frames).
    const dodging = now < dodgeUntil;
    if (!dodging) {
      for (const id of Object.keys(world.enemies).sort()) {
        const e = world.enemies[id];
        if (!e.alive || dist(world.player, e) > 1) continue;
        if (now >= (enemyCd[id] || 0)) {
          dispatch({ type: 'ENEMY_STRIKE', enemyId: id });
          enemyCd[id] = now + ENEMY_CD_MS;
        }
      }
    }

    if (now >= nextTickAt) {
      dispatch({ type: 'TICK' });
      nextTickAt = now + TICK_MS;
    }
  }

  function frame(now) {
    const dt = Math.min(now - last || 16, MAX_FRAME_MS);
    last = now;

    const { move, presses, device } = input.poll();
    view.device = input.hasTouch && device === 'keyboard' ? 'touch' : device;

    if (view.modal) handleModal(presses);
    else handleWorld(now, move, presses);

    // Smooth display position — floats live here, never in the sim.
    const k = Math.min(1, dt * 0.02);
    view.px += (world.player.x - view.px) * k;
    view.py += (world.player.y - view.py) * k;
    view.dodging = now < dodgeUntil;
    for (const t of view.toasts) t.ttl -= dt;
    view.toasts = view.toasts.filter((t) => t.ttl > 0);

    input.setZones(render(ctx, ro, view));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hook: the harness is just another device driving the same seams.
  return {
    world: () => ro,
    dispatch,
    view,
  };
}
