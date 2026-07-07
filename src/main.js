// Boot shell (presentation layer). Reads sim state, never writes it.
// Stage 0: run the shared demo script in the browser and display the
// fingerprint — it must match `npm run smoke`'s golden value exactly.
// That parity check is the point of this page; Stage 2 replaces it with
// the real renderer.

import { makeWorld } from './sim/world.js';
import { replay } from './sim/reduce.js';
import { fingerprint } from './sim/fingerprint.js';
import { DEMO_SEED, demoCommands } from './sim/demo.js';

const GOLDEN_DEMO_FINGERPRINT = '007a5d05'; // must match scripts/smoke.mjs

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function boot() {
  const world = makeWorld(DEMO_SEED);
  replay(world, demoCommands());
  const fp = fingerprint(world);
  const match = fp === GOLDEN_DEMO_FINGERPRINT;

  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PROLOGUE', canvas.width / 2, 90);

  ctx.fillStyle = '#8892b0';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Stage 0 — deterministic harness', canvas.width / 2, 120);

  ctx.font = '16px ui-monospace, monospace';
  ctx.fillStyle = match ? '#7CFC9A' : '#ff6b6b';
  ctx.fillText(`fingerprint ${fp}`, canvas.width / 2, 170);
  ctx.fillText(match ? 'MATCHES Node golden ✓' : `EXPECTED ${GOLDEN_DEMO_FINGERPRINT} ✗`,
    canvas.width / 2, 195);
}

boot();
