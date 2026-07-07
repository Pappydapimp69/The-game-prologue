// makeWorld is the ONLY constructor of authoritative state. New Game, tests,
// and save-schema defaults all go through here — "new" must rebuild the world
// via this path, never by reopening setup UI over stale state.
//
// Stage 0 walking skeleton: just enough state to prove the harness. Stage 1
// replaces the innards; the contract (single constructor, rng inside state,
// integers only in authoritative fields) is permanent.

import { makeRng } from './rng.js';

export const WORLD_VERSION = 'stage0';

export function makeWorld(seed) {
  if (!Number.isInteger(seed)) throw new Error('makeWorld: seed must be an integer');
  return {
    version: WORLD_VERSION,
    seed: seed >>> 0,
    tick: 0,
    rng: makeRng(seed >>> 0),
    player: { x: 0, y: 0, hp: 10, tally: 0 },
  };
}
