// Boot shell. Everything here is presentation; the sim lives in src/sim and
// is only ever mutated through game.js's dispatch.

import { startGame } from './app/game.js';

const canvas = document.getElementById('game');

// ?seed=N&arch=seeker&difficulty=harsh for reproducible/custom sessions;
// Stage 5's title screen owns the real new-game/continue flow.
const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed') ?? '', 10);
const options = {};
if (params.get('arch')) options.archetype = params.get('arch');
if (params.get('difficulty')) options.difficulty = params.get('difficulty');

const game = startGame(canvas, Number.isInteger(seed) ? seed : 0xa17a5, options);

// Test hook — lets a headless harness read state and drive the same command
// vocabulary as any input device. Read-only proxy: writes throw.
window.__game = game;
