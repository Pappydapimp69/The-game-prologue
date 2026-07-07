// reduce(state, command) is the ONLY thing that mutates authoritative state.
// It returns an array of events for the presentation layer to consume; the
// renderer reads state and never writes it. Authoritative fields hold
// integers only — floats (and anything frame-rate-dependent) stay in the
// presentation layer.
//
// Stage 0 commands are placeholders that exercise every harness path
// (movement, rng, damage). Stage 1 replaces them with the real verb set.

import { nextInt } from './rng.js';

export function reduce(state, command) {
  switch (command.type) {
    case 'TICK': {
      state.tick += 1;
      return [];
    }
    case 'MOVE': {
      const { dx, dy } = command;
      if (!Number.isInteger(dx) || !Number.isInteger(dy)) {
        throw new Error('MOVE: dx/dy must be integers');
      }
      state.player.x += Math.max(-1, Math.min(1, dx));
      state.player.y += Math.max(-1, Math.min(1, dy));
      return [{ type: 'moved', x: state.player.x, y: state.player.y }];
    }
    case 'ROLL': {
      const roll = nextInt(state.rng, 20) + 1;
      state.player.tally += roll;
      return [{ type: 'rolled', roll }];
    }
    case 'DAMAGE': {
      if (!Number.isInteger(command.amount) || command.amount < 0) {
        throw new Error('DAMAGE: amount must be a non-negative integer');
      }
      state.player.hp = Math.max(0, state.player.hp - command.amount);
      return [{ type: 'damaged', hp: state.player.hp }];
    }
    default:
      throw new Error(`reduce: unknown command ${command.type}`);
  }
}

// Runs a command stream against a fresh-ish state. Test/replay helper.
export function replay(state, commands) {
  const events = [];
  for (const c of commands) events.push(...reduce(state, c));
  return events;
}
