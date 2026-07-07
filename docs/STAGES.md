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

## Stage 2 — Render + input ✅ (closed 2026-07-07)

Scope: canvas renderer behind a recursive read-only Proxy (a renderer write
throws — enforced mechanically, tested live in Chromium); 8-direction tile
movement with hold-repeat and smooth display interpolation (floats live in
presentation only); unified intent vocabulary across keyboard / touch
(on-screen d-pad + word-labeled buttons) / gamepad (polled every frame);
device-adaptive control legend; modal system (dialog, quest offer, shop,
defeat) that pauses the overworld but never the loop, all dismissals through
one path; enemy AI as ENEMY_STRIKE commands with per-enemy cooldown; dodge
window = withholding strikes; frame delta capped.

Evidence:
- `npm run smoke`: 21/21 (new: read-only boundary test).
- Chromium e2e: booted, quest accepted through the modal, held-key movement,
  charge meter, live boundary rejection, on-screen d-pad movement on an
  emulated Pixel 5 — all passing; desktop + touch screenshots captured.
- Sim untouched: golden `a3152602` and Node/browser parity unchanged.
- Real bug found & fixed: input edges were SAMPLED at frame time, so a press
  shorter than one frame (fast taps, automated input) was silently lost —
  presses are now CAPTURED at event time into a pending queue that the next
  frame consumes. Filed to Brain.

## Stage 3 — Content systems, data-driven ✅ (closed 2026-07-07)

Scope: all content moved to `src/sim/content.js` (pure data — regions, NPCs
w/ dialog + shops, enemy kinds, items, quests, zones, archetypes); makeWorld
builds state FROM content (definitions copied in, so a running save never
shifts under a content edit); new `reach` objective type; archetypes
(Brawler/Channeler/Seeker) front-load identity, growth stays use-based;
perception-gated information (enemy readout shows exact HP/power only past
the kind's senseReq — the earned scouter); Gentle/Harsh difficulty as an
authoritative sim setting (harsh: +1 enemy damage).

Evidence:
- `npm run smoke`: 27/27. Golden updated once: `201c297b`.
- Validation ladder live: schema → referential integrity → completability →
  headless playthrough. Nine deliberate content corruptions (typo'd quest id,
  kill target with no spawns, unobtainable item, unknown enemy kind, missing
  zone, unpriced shop item, spawn on blocked tile, out-of-bounds zone) all
  fail the build, not the player.
- Perception verified visually: Seeker reads husks, stalker stays "???".
- Difficulty verified deterministic: harsh = gentle + 1 on the same roll.
- Stage 2 e2e re-run green; Node/Chromium parity on the new golden.
- Fixed en route: quest tracker rendered "find undefined" for reach
  objectives (label switch missing the new type).

## Stage 4 — The Prologue arc ✅ (closed 2026-07-07)

Scope: the opening arc as a sim-state overlay that OBSERVES gameplay events
(9 teaching steps: move/talk/quest/capsule/crate/melee/aura/tonic/pass, each
mapped narrowly — the training crate completes `crate`, nothing else); the
Ravager boss spawns only when every step is done; two-phase fight (ALLY_STRIKE
mentor commands in phase 1; at half health the mentor falls and they refuse);
the one real choice (spare/finish — CHOOSE_FATE, undismissable); the eastern
gate as authoritative exit (sealed until arc complete); finale with the
Firstborn transformation legend (survivorship-bias seed for the saga) and the
`saga.v1` export code (SAGA1.<base64 canonical JSON>.<fnv1a32>). One-line
guide hint at a time; story text lives in content, mechanics in the sim.

Evidence:
- `npm run smoke`: 35/35. Golden updated once: `dd14f521`.
- Headless full-arc completion: taught, fought, chose, left — all flags
  asserted; gate refuses early exit; boss won't pre-spawn with a step
  missing; fallen mentor's strikes refuse; invalid fates throw.
- Export code round-trips (archetype/skills/choice survive); tampered,
  truncated, garbage, and wrong-version codes politely refused.
- Browser e2e: full arc driven through the live dispatch seam, finale modal
  up with a well-formed code; screenshot captured. Stage 2 e2e green.
- Fixed en route: modal text/button overlap on long payload lines.

## Stage 5 — Feel + ship ✅ (closed 2026-07-07)

Scope: game feel — screen shake, hit-stop (brief gameplay-logic freeze on
impact; rendering keeps running so the shake/punch plays out), squash-on-hit
for enemies/crates, a lunge-stretch for the player's own landed attacks, all
purely presentational and driven by sim events (zero changes to authoritative
state); day/night as an integer world-clock (`src/sim/daynight.js`, no
transcendental math — the sim's determinism guard still passes) that stacks
+1 enemy damage at night, with a cosmetic tint (`src/app/daynight-tint.js`,
free to use easing math since it's presentation-only); a title screen
(Continue / New Game / Controls) with an archetype + Gentle/Harsh picker,
fully keyboard/gamepad-navigable (stick or D-pad cycles, confirm selects) and
click/tap-operable; a single localStorage save slot with autosave after every
dispatch, New Game always going through the real `makeWorld()` (never
reopening setup over stale state), and an overwrite confirmation before a
save is destroyed; an explicit GitHub Pages deploy workflow (runs the smoke
suite as a gate, then `configure-pages`/`upload-pages-artifact`/`deploy-pages`
— not the dynamic builder, which can queue silently).

Evidence:
- `npm run smoke`: 37/37 (new: day/night determinism + damage-stacking
  tests). Golden fingerprint unchanged (`dd14f521`) — juice and day/night
  touch nothing the golden replay exercises differently.
- Browser e2e (title flow, archetype selection, save/continue round-trip,
  overwrite confirmation): 8/8 passing. Continue resumes the exact position,
  archetype, and quest progress after a full page reload; declining the
  overwrite prompt preserves the existing save.
- Stage 2 and Stage 4 e2e re-run green through the new title-screen gate.
- Real bug found & fixed: `input.js`'s press vocabulary was hard-limited to
  the fixed ACTIONS list, so title-screen zone ids (outside that list, unlike
  modal buttons which deliberately reuse action names) never fired — pending
  event-time captures now promote directly to one-shot presses regardless of
  vocabulary. Found because the title screen simply didn't respond to clicks
  in first testing.
