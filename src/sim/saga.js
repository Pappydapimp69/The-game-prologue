// The carryover contract between games of the saga. Decided in game 1,
// versioned forever: SAGA1.<base64 canonical JSON>.<fnv1a32 checksum>.
// Every sequel accepts a code OR a fresh start — the code is a courtesy,
// never a wall. Format follows the researched pattern: fixed signature
// prefix + version + integrity checksum appended.

import { stableStringify } from './canonical.js';
import { fnv1a32 } from './fingerprint.js';

export const SAGA_VERSION = 'saga.v1';
const PREFIX = 'SAGA1';

export function exportSaga(state) {
  if (!state.flags.ended) throw new Error('exportSaga: the prologue is not finished');
  const data = {
    v: SAGA_VERSION,
    game: 'prologue',
    archetype: state.settings.archetype,
    difficulty: state.settings.difficulty,
    skills: {
      melee: state.player.skills.melee.lvl,
      aura: state.player.skills.aura.lvl,
      perception: state.player.skills.perception.lvl,
    },
    coins: state.player.coins,
    techniques: [], // reserved: prologue teaches the basics, Part II grants named techniques
    choices: {
      ravagerFate: state.arc.choice, // 'spare' | 'finish' — Part II remembers
    },
  };
  const json = stableStringify(data);
  const payload = btoa(json);
  return `${PREFIX}.${payload}.${fnv1a32(payload)}`;
}

// Returns { ok: true, data } or { ok: false, error }. Never throws on user
// input — a mistyped code is a player mistake, not a crash.
export function importSaga(code) {
  if (typeof code !== 'string') return { ok: false, error: 'not a string' };
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, error: 'not a saga code' };
  const [, payload, check] = parts;
  if (fnv1a32(payload) !== check) return { ok: false, error: 'checksum mismatch — mistyped or altered' };
  let data;
  try { data = JSON.parse(atob(payload)); } catch { return { ok: false, error: 'corrupt payload' }; }
  if (data.v !== SAGA_VERSION) return { ok: false, error: `unsupported version ${data.v}` };
  for (const field of ['archetype', 'skills', 'choices']) {
    if (!data[field]) return { ok: false, error: `missing field ${field}` };
  }
  return { ok: true, data };
}
