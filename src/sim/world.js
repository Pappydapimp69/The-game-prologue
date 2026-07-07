// makeWorld is the ONLY constructor of authoritative state. New Game, tests,
// and save-schema defaults all go through here — "new" must rebuild the world
// via this path, never by reopening setup UI over stale state.
//
// Authoritative fields are integers only; floats live in presentation.
// Stage 1 embeds a small starter region inline; Stage 3 moves content to
// data files validated by the smoke ladder. Entity ids are stable strings —
// commands target by id, never by array index.

import { makeRng } from './rng.js';

export const WORLD_VERSION = 'stage1';

export function makeWorld(seed) {
  if (!Number.isInteger(seed)) throw new Error('makeWorld: seed must be an integer');
  return {
    version: WORLD_VERSION,
    seed: seed >>> 0,
    tick: 0,
    rng: makeRng(seed >>> 0),
    player: {
      x: 5, y: 5,
      hp: 20, maxHp: 20,
      aura: 0, maxAura: 10,
      coins: 0,
      skills: {
        melee: { lvl: 1, xp: 0 },
        aura: { lvl: 1, xp: 0 },
        perception: { lvl: 1, xp: 0 },
      },
      inventory: [],
    },
    region: {
      id: 'foothold-vale',
      w: 24, h: 16,
      // Blocked tiles as "x,y" keys — cheap integer collision.
      blocked: { '10,5': 1, '10,6': 1, '10,7': 1 },
    },
    npcs: {
      warden: { x: 6, y: 5, name: 'Warden Oren', offers: 'clear-the-road' },
      keeper: { x: 4, y: 8, name: 'Shop Keeper' },
    },
    enemies: {
      husk1: { x: 12, y: 6, kind: 'husk', hp: 8, maxHp: 8, power: 2, alive: 1 },
      husk2: { x: 14, y: 9, kind: 'husk', hp: 8, maxHp: 8, power: 2, alive: 1 },
    },
    destructibles: {
      crate1: { x: 7, y: 7, broken: 0, coins: 3 },
    },
    pickups: {
      capsule1: { x: 8, y: 4, item: 'training-capsule', taken: 0 },
    },
    shop: {
      'tonic': { price: 3, heal: 5 },
    },
    quests: {
      // Definitions are content; runtime status lives under status.
      defs: {
        'clear-the-road': {
          giver: 'warden',
          objectives: [
            { type: 'kill', target: 'husk', n: 2 },
            { type: 'collect', item: 'training-capsule' },
          ],
          reward: { coins: 10 },
        },
      },
      offered: {},   // questId -> 1 (offered, never pushed — accepting is a command)
      active: {},    // questId -> { progress: [ints per objective] }
      completed: {}, // questId -> 1
    },
    flags: {},
  };
}
