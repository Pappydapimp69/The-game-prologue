# Build stages (agent-facing — never player-facing UI)

No stage begins until the previous stage's success criteria pass in
`npm run smoke`. Closure evidence lives here, not in the game.

## Stage 0 — Deterministic harness ✅ (closed 2026-07-07)

Scope: repo scaffold; seeded RNG (sfc32, full-state O(1) restore); canonical
sorted-key serializer that fails loud on NaN/Infinity/undefined/-0; FNV-1a
state fingerprint; minimal walking-skeleton sim (TICK/MOVE/ROLL/DAMAGE) to
exercise the harness; golden replay test; forbidden-token determinism guard;
browser boot page sharing the exact sim modules.

Evidence:
- `npm run smoke`: 14/14 passing. Golden demo fingerprint `007a5d05` baked.
- Save/load mid-run resumes bit-exact (JSON round-trip mid-stream equals
  uninterrupted run).
- Browser parity verified in headless Chromium: page fingerprint `007a5d05`
  matches the Node golden value.
- Research flags folded in: canonical stringify for hashing (JSON.stringify
  key order is insertion-dependent); PRNG saves full state words instead of a
  replayed roll count; transcendental Math (sin/cos/…) banned from src/sim
  (engine-implementation-defined), IEEE-exact ops (sqrt/floor/…) allowed.

## Stage 1 — Sim core (real verbs) ✅ (closed 2026-07-07)

Scope: real command vocabulary replacing the walking skeleton — MOVE on the
region grid with blocked-tile collision, TALK, ACCEPT_QUEST (offered, never
pushed), INTERACT (one-shot pickups deactivate instantly), BREAK, MELEE,
CHARGE + AURA_BLAST (meter, range, cost), ENEMY_STRIKE (enemy aggression is
its own command; dodge i-frames = the renderer withholding it — no
invulnerability flag in state), BUY, USE_ITEM; use-based skill growth
(melee/aura/perception); quest objective progress by TYPE (kill/collect —
the code/content seam) with completion + reward.

Evidence:
- `npm run smoke`: 20/20 passing. Golden updated once: `a3152602`.
- Demo script exercises every verb end-to-end (quest completed, both enemies
  down, capsule collected, crate broken, tonic bought and consumed, skills
  grew from use).
- Verb-contract tests: offer-not-push, blocked movement, aura meter
  need/cap, out-of-range refusal, no-invuln-flag invariant.
- Browser parity re-verified in Chromium: `a3152602` matches Node.

## Stage 2 — Render + input

Canvas renderer (reads state, never writes — freeze or lint the boundary);
8-direction movement; unified command vocabulary across keyboard/touch/gamepad
(poll getGamepads() every frame); device-adaptive labels in words; modals pause
the overworld but never any live embedded surface.
Success: parity page still matches; manual play on desktop + touch.

## Stage 3 — Content systems, data-driven

Quests/enemies/NPCs/items as JSON referencing objective TYPES handled in the
reducer. Validation ladder in smoke: schema → referential integrity /
completability → headless playthrough. Archetypes at creation; skill-gated
information (perception); quests offered, never pushed; Gentle/Harsh setting.
Success: a typo'd content id fails smoke, not the player.

## Stage 4 — The Prologue arc

Opening-arc state overlay observing real gameplay events, one verb at a time;
region exit gated on arc completion; two-phase finale boss (with mentor, then
alone); cliffhanger + transformation legend + versioned `saga.v1` export code.
Success: headless completion of the full arc; export code round-trips a
validator; tutorial objects mapped narrowly (never satisfy later quests).

## Stage 5 — Feel + ship

Screen shake / hit-stop / aura glow; day-night tint with night aggression;
title screen (Continue / New Game / Controls — New Game calls the real full
reset); GitHub Pages deploy workflow (explicit Actions workflow, not the
dynamic builder).
Success: 60–90 min finish by a new player on phone or gamepad, nothing read
outside the game.
