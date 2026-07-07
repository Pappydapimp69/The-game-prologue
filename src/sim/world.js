// makeWorld is the ONLY constructor of authoritative state. New Game, tests,
// and save-schema defaults all go through here.
//
// The world is BUILT FROM CONTENT (src/sim/content.js) — definitions are
// copied into state at construction so a running save never shifts under a
// content edit. Authoritative fields are integers only.

import { makeRng } from './rng.js';
import { CONTENT } from './content.js';

export const WORLD_VERSION = 'stage3';

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

  const enemies = {};
  for (const [id, e] of Object.entries(regionDef.enemies)) {
    const kind = CONTENT.enemyKinds[e.kind];
    enemies[id] = { x: e.x, y: e.y, kind: e.kind, hp: kind.hp, maxHp: kind.hp, power: kind.power, alive: 1 };
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
    pickups[id] = { x: p.x, y: p.y, item: p.item, taken: 0 };
  }
  const blocked = {};
  for (const b of regionDef.blocked) blocked[b] = 1;

  const questDefs = {};
  for (const [qid, q] of Object.entries(CONTENT.quests)) {
    questDefs[qid] = JSON.parse(JSON.stringify(q));
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
    flags: {},
  };
}
