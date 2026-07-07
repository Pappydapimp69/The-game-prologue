// Headless smoke suite — the Stage 0 gate. Run: npm run smoke (or node scripts/smoke.mjs)
// No stage begins until this passes. Zero dependencies, pure Node.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { stableStringify } from '../src/sim/canonical.js';
import { fingerprint, fnv1a32 } from '../src/sim/fingerprint.js';
import { makeRng, nextU32, nextInt } from '../src/sim/rng.js';
import { makeWorld } from '../src/sim/world.js';
import { replay } from '../src/sim/reduce.js';
import { DEMO_SEED, demoCommands } from '../src/sim/demo.js';
import { readonly } from '../src/app/readonly.js';

// Baked golden value for the demo playthrough. An INTENDED sim/content change
// updates this one line (review the diff); an unintended divergence is a bug.
const GOLDEN_DEMO_FINGERPRINT = 'a3152602';

const failures = [];
let count = 0;
function test(name, fn) {
  count++;
  try {
    fn();
    console.log(`  ok ${count} - ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  FAIL ${count} - ${name}\n      ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: ${a} !== ${b}`);
}

console.log('# canonical serialization');

test('key order does not change output', () => {
  assertEqual(stableStringify({ a: 1, b: [2, { d: 4, c: 3 }] }),
    stableStringify({ b: [2, { c: 3, d: 4 }], a: 1 }));
});

test('integer-like keys serialize identically regardless of insertion', () => {
  const x = {}; x['10'] = 'a'; x['2'] = 'b';
  const y = {}; y['2'] = 'b'; y['10'] = 'a';
  assertEqual(stableStringify(x), stableStringify(y));
});

test('-0 normalizes to 0', () => {
  assertEqual(stableStringify({ v: -0 }), stableStringify({ v: 0 }));
});

test('NaN / Infinity / undefined fail loud', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined]) {
    let threw = false;
    try { stableStringify({ bad }); } catch { threw = true; }
    assert(threw, `expected throw for ${bad}`);
  }
});

console.log('# seeded rng (sfc32, full-state saves)');

test('same seed, same stream', () => {
  const a = makeRng(12345), b = makeRng(12345);
  for (let i = 0; i < 100; i++) assertEqual(nextU32(a), nextU32(b));
});

test('state restores in O(1) mid-stream and continues identically', () => {
  const a = makeRng(777);
  for (let i = 0; i < 50; i++) nextU32(a);
  const saved = JSON.parse(JSON.stringify(a));
  const tail1 = Array.from({ length: 20 }, () => nextU32(a));
  const tail2 = Array.from({ length: 20 }, () => nextU32(saved));
  assertEqual(tail1.join(','), tail2.join(','));
});

test('nextInt stays in range and is unbiased-by-construction', () => {
  const r = makeRng(9);
  for (let i = 0; i < 1000; i++) {
    const v = nextInt(r, 6);
    assert(v >= 0 && v < 6, `out of range: ${v}`);
  }
});

test('fnv1a32 known vector', () => {
  // Well-known FNV-1a test vectors.
  assertEqual(fnv1a32(''), '811c9dc5');
  assertEqual(fnv1a32('a'), 'e40c292c');
});

console.log('# authoritative sim: golden replay + save/load');

test('makeWorld is deterministic (New Game contract)', () => {
  assertEqual(fingerprint(makeWorld(42)), fingerprint(makeWorld(42)));
});

const runDemo = () => {
  const w = makeWorld(DEMO_SEED);
  replay(w, demoCommands());
  return w;
};

test('replay twice from the same seed → identical fingerprint', () => {
  assertEqual(fingerprint(runDemo()), fingerprint(runDemo()));
});

test('demo fingerprint matches baked golden value', () => {
  const fp = fingerprint(runDemo());
  if (GOLDEN_DEMO_FINGERPRINT === '__PENDING__') {
    throw new Error(`golden not baked yet — set GOLDEN_DEMO_FINGERPRINT='${fp}'`);
  }
  assertEqual(fp, GOLDEN_DEMO_FINGERPRINT, 'golden fingerprint diverged');
});

test('save/load mid-run resumes bit-exact', () => {
  const cmds = demoCommands();
  const half = Math.floor(cmds.length / 2);

  const uninterrupted = makeWorld(DEMO_SEED);
  replay(uninterrupted, cmds);

  const first = makeWorld(DEMO_SEED);
  replay(first, cmds.slice(0, half));
  const reloaded = JSON.parse(JSON.stringify(first)); // save → load
  replay(reloaded, cmds.slice(half));

  assertEqual(fingerprint(reloaded), fingerprint(uninterrupted));
});

test('unknown command fails loud', () => {
  let threw = false;
  try { replay(makeWorld(1), [{ type: 'NOPE' }]); } catch { threw = true; }
  assert(threw);
});

console.log('# stage 1 verbs');

test('demo playthrough exercises every verb end-to-end', () => {
  const w = runDemo();
  assert(w.quests.completed['clear-the-road'] === 1, 'quest not completed');
  assert(!w.enemies.husk1.alive && !w.enemies.husk2.alive, 'husks still alive');
  assert(w.pickups.capsule1.taken === 1, 'capsule not taken');
  assert(w.destructibles.crate1.broken === 1, 'crate not broken');
  assert(w.player.inventory.includes('training-capsule'), 'capsule not in inventory');
  assert(!w.player.inventory.includes('tonic'), 'tonic bought but not consumed');
  assert(w.player.hp > 0 && w.player.hp <= w.player.maxHp, `hp out of range: ${w.player.hp}`);
  assert(w.player.skills.melee.xp > 0 || w.player.skills.melee.lvl > 1, 'melee use gave no growth');
  assert(w.player.skills.aura.xp > 0 || w.player.skills.aura.lvl > 1, 'aura use gave no growth');
});

test('quests are offered, never pushed', () => {
  const w = makeWorld(1);
  const ev = replay(w, [{ type: 'TALK', npcId: 'warden' }]);
  assert(ev.some(e => e.type === 'quest_offered'), 'no offer event');
  assert(w.quests.offered['clear-the-road'] === 1, 'not in offered');
  assert(!w.quests.active['clear-the-road'], 'quest auto-activated — must require ACCEPT_QUEST');
});

test('blocked tile stops movement', () => {
  const w = makeWorld(1);
  w.player.x = 9; w.player.y = 5;
  const ev = replay(w, [{ type: 'MOVE', dx: 1, dy: 0 }]);
  assert(ev.some(e => e.type === 'blocked'));
  assert(w.player.x === 9 && w.player.y === 5, 'player moved into a wall');
});

test('aura blast needs charge; charge caps at max', () => {
  const w = makeWorld(1);
  w.player.x = 11; w.player.y = 6; // in range of husk1
  const ev = replay(w, [{ type: 'AURA_BLAST', enemyId: 'husk1' }]);
  assert(ev.some(e => e.type === 'no_aura'), 'blast fired with empty meter');
  replay(w, Array.from({ length: 20 }, () => ({ type: 'CHARGE' })));
  assert(w.player.aura === w.player.maxAura, 'charge blew past max');
  const ev2 = replay(w, [{ type: 'AURA_BLAST', enemyId: 'husk1' }]);
  assert(ev2.some(e => e.type === 'enemy_hit'), 'charged blast did not hit');
});

test('no invulnerability flag exists — i-frames are command-withholding', () => {
  const w = runDemo();
  assert(!('invulnerable' in w.player) && !('iframes' in w.player),
    'transient combat flags leaked into authoritative state');
});

test('out-of-range attacks refuse instead of hitting', () => {
  const w = makeWorld(1);
  const ev = replay(w, [{ type: 'MELEE', enemyId: 'husk1' }]); // spawn is far away
  assert(ev.some(e => e.type === 'too_far'));
  assert(w.enemies.husk1.hp === w.enemies.husk1.maxHp);
});

console.log('# renderer boundary');

test('read-only proxy throws on any write, at any depth', () => {
  const w = makeWorld(1);
  const ro = readonly(w);
  assertEqual(ro.player.hp, w.player.hp, 'proxy must read through');
  let threw = 0;
  try { ro.player.hp = 0; } catch { threw++; }
  try { ro.tick = 99; } catch { threw++; }
  try { delete ro.player; } catch { threw++; }
  assertEqual(threw, 3, 'a renderer write slipped through the boundary');
  assertEqual(w.player.hp, 20, 'underlying state was mutated');
});

console.log('# determinism guard: forbidden tokens in src/sim');

test('src/sim never touches ambient time, randomness, or engine-varying math', () => {
  const simDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'sim');
  // Math.sqrt/abs/floor/ceil/round/min/max/trunc/sign/imul are IEEE-exact and allowed.
  const banned = /Math\.random|Date\.now|performance\.now|new Date|Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log2|log10|log1p|pow|hypot|cbrt)\b/;
  for (const f of readdirSync(simDir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(simDir, f), 'utf8');
    const m = src.match(banned);
    assert(!m, `${f} contains banned token: ${m && m[0]}`);
  }
});

console.log('');
if (failures.length) {
  console.error(`SMOKE FAILED: ${failures.length}/${count} test(s)`);
  process.exit(1);
}
console.log(`SMOKE PASSED: ${count}/${count}`);
