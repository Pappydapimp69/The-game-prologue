# Prologue — Proposal (approved 2026-07-07)

Game 1 of a 5-part single-player offline saga: an open-world 2D top-down action
RPG. Original IP with Dragon Ball Z's tonal DNA — training, power growth, aura
techniques, a mythologized legendary transformation — but no copied names,
characters, or assets.

## The saga

- Ki → **Aura**. Scouter → a perception skill that gates information (low
  perception shows "???" instead of an enemy's power). Super Saiyan → a
  **legendary transformation** whose secret is survivorship bias: it was
  "legendary" only because no one who attained it survived to explain it.
  The Prologue seeds the myth; a later game pays it off.
- Five games = five arcs of one story (home → rival → tyrant → artificial
  threat → apocalyptic scale), each ending on a cliffhanger.
- **Carryover contract:** a versioned base64 export code (`saga.v1`) shown at
  each game's finale — name, archetype, skill levels, techniques learned, and
  named choice flags. Every sequel accepts a code or a fresh-start default.
  No backend, works offline.

## The Prologue (this game)

60–90 minutes, one region (village + wilds + one dungeon). Linear guided first
act that opens into free roam before the finale. Teaches one verb at a time
through real play — an opening-arc overlay that observes real gameplay events,
never a separate tutorial mode: move → talk → interact/break → melee → dodge →
aura blast + charge → shop → quest (offered, never pushed) → train (use-based
skill growth) → save. Region exit gated on arc completion. Finale boss in two
phases: alongside the mentor, then alone. Ends with a cliffhanger, the
transformation legend spoken once, and the export code.

## Technical spine

Vanilla JS + HTML5 canvas, zero dependencies, static hosting (GitHub Pages).
Keyboard + touch + gamepad through one command vocabulary. Architecture rules
(permanent, enforced by the smoke suite where possible):

- `reduce(state, command)` is the only mutator of authoritative state; the
  renderer reads state and never writes it.
- Seeded RNG (sfc32) with its full state inside the saved world; no ambient
  randomness, clock reads, or engine-varying transcendental math in `src/sim`.
- Authoritative fields are integers; floats live in presentation only.
- `makeWorld()` is the single constructor; New Game goes through it.
- Content is data-driven against objective *types*, with a validation ladder:
  schema → referential integrity → headless smoke playthrough.
- Golden replay-fingerprint test (canonical sorted-key serialization, FNV-1a)
  guards determinism and doubles as a regression gate.

## Build stages

See `docs/STAGES.md`. Each stage is gated by `npm run smoke`.
