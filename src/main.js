// Boot shell. Everything here is presentation; the sim lives in src/sim and
// is only ever mutated through game.js's dispatch.

import { startGame } from './app/game.js';

const canvas = document.getElementById('game');

// ?seed=N for reproducible sessions; Stage 5's title screen owns real
// new-game/continue flow.
const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed') ?? '', 10);

const game = startGame(canvas, Number.isInteger(seed) ? seed : 0xa17a5);

// Test hook — lets a headless harness read state and drive the same command
// vocabulary as any input device. Read-only proxy: writes throw.
window.__game = game;
