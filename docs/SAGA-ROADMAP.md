# Saga roadmap — phase scope map (2026-07-07)

Six independent repos, one continuous story (`saga.v1` export code carries
name/archetype/skills/choices between them). "Independent" is structural, not
just intentional: **a later phase can clone an earlier repo and reuse its
assets, but it can never edit it.** Each phase repo is its own build, gated by
its own `npm run smoke`, with its own STAGES.md closure log. This doc exists
so research done *while building* one phase gets filed against the phase it
actually belongs to, instead of leaking scope into whichever repo happens to
be open at the time.

## Phase 1 — Prologue (`The-game-prologue`, this repo) ✅ shipped

Colorless-on-purpose (see `docs/PROPOSAL.md`). Deterministic sim core,
data-driven content, opening-arc teaching overlay, one region. Nothing further
assigned here; it's closed.

## Phase 2 — Wrong Sky (`The-game-wrong-sky`) — next, scope confirmed

Theme: Phase 1 was mostly colorless; Phase 2 is about *seeing* — graphics and
feel, GRIS-style progressive unlocks tied to the story, layered on a full
gameplay phase (not a graphics-only build — see below). Accessibility work is
explicitly dropped from this phase's scope (deferred, not discarded — revisit
per-phase as each repo's own UI matures, or fold into a later cross-cutting
pass if it becomes a pattern worth codifying).

**Visual unlocks are a progression system that runs parallel to real
gameplay — they are not the content of the phase.** Phase 2 is a full
gameplay phase like Phase 1: it advances the story, introduces new enemies,
new goals/objectives, and an inventory system, same as any saga entry would.
The GRIS-style color/visual-tier unlocks are layered on top of that real
progression (tied to story beats and player milestones, same as Phase 1's
use-based skill growth was tied to real play) — they decorate advancement,
they don't replace it. A build that shipped only visual unlocks with no new
enemies/goals/inventory would be under-scoped for this phase.

Gameplay content assigned to Phase 2 (not researched yet — standard scope for
any saga phase, carried over from the Phase 1 pattern):

- **New enemies** — continuing the story's escalation past the Prologue's
  Ravager; own enemyKinds, own encounters.
- **New goals/objectives** — the quest system already supports kill/collect/
  reach; Phase 2's story needs its own quest content built on it (and any new
  objective types the story requires).
- **Inventory system** — Phase 1 had a flat `player.inventory` array with no
  UI beyond auto-use; Phase 2 needs an actual inventory (equip/manage/view),
  which the visual-unlock gear likely surfaces through.

Assigned to Phase 2 (graphics/feel research, all fit one region + one story
arc, none need world-scale infrastructure):

- **Resolution/DPI + text scaling** — reference-resolution + scale-factor
  responsive canvas (fill-not-letterbox), so the game occupies the full field
  of view on whatever monitor it's running on; text scales with it for
  readability. This was explicitly requested ("the game should adapt to the
  scale of the monitor... without cutting off").
- **Color palette + progressive unlock** — limited palette + shading-ramp +
  hue-shift technique; GRIS's chapter-gated color-as-narrative mechanic
  adapted so each unlocked visual tier is tied to a story beat, not a menu
  toggle.
- **One audio-unlock interactable** — per the approved pivot: a single object
  in the world that turns on audio, since audio itself is mostly addressed
  already and doesn't need a phase of its own.
- **Sprite animation** — frame timing with uneven holds for perceived weight
  (Steve Swink's game-feel/juice framing carries over from Phase 1's
  hit-stop/squash work, applied here to sprite work instead of just impacts).
- **Camera** — deadzone, smoothing, clamp-to-region-bounds. Single-region
  scope like Phase 1, so no streaming/scrolling-world concerns yet.
- **Y-sorting** — draw-order-by-depth for a top-down scene with verticality.
- **Ambient occlusion / local lighting** — the "some solid objects can't be
  seen through, some objects emit light where light is otherwise absent"
  request. Scoped as shadow-casting/occlusion + simple emissive light sources
  for one region's worth of geometry — not a general lighting engine.
- **Basic viewport culling** — only what's needed to keep one region's frame
  budget stable now that lighting/Y-sort add per-entity draw cost; this is
  the *presentational* half of culling, distinct from Phase 4's spatial
  partitioning for a much larger world.

## Phase 3 — Rival AI

Nothing new assigned from this research round. Existing plan (from the saga
outline) stands: the rival introduced in Phase 2/3's story beats gets AI
behavior here. Revisit once Phase 2 research surfaces anything AI-adjacent.

## Phase 4 — World-scale systems

Assigned here because they only pay off once the world is bigger than one
region, which Phase 2 deliberately is not:

- **Minimap / world map** — needs multiple regions to be worth having.
- **Tilemap pipeline (Tiled TMX/JSON)** — authoring at world scale; Phase 1/2
  hand-authored single regions don't need an external tilemap tool yet.
- **Deeper multi-tile/entity collision** — beyond single-tile blocked-grid
  collision, for denser or larger world geometry.
- **Deeper performance/spatial partitioning** — beyond Phase 2's basic
  viewport culling; needed once entity/tile counts scale past one region.

## Phase 5 — Boss design

No new topics assigned from this round.

## Phase 6 — Branching consequences

No new topics assigned from this round.

## Cross-cutting (every phase, not phase-specific)

- **Save schema versioning** — additive-only fields with defaults for old
  saves, never rename/remove. Already an established Phase 1 practice, not a
  new research item; every phase's own save schema follows it independently
  since save data does not cross repos (only the `saga.v1` export code does).
- **Determinism spine** — integer authoritative state, seeded RNG, no ambient
  randomness/clock reads in `src/sim`, canonical-serialization golden
  fingerprint test. Every phase repo re-establishes this itself at its own
  Stage 0; it is a pattern to repeat, not shared code to import (repos don't
  depend on each other).

## Why this split

Phase 2's danger was scope creep: graphics research kept surfacing adjacent
systems (minimap, tilemap, deeper collision) that are real and worth building
eventually, but don't belong in a one-region, graphics-and-feel-focused repo.
Sorting them into Phase 4 now — before Phase 2's build starts — keeps Phase 2
buildable in the same disciplined, staged way Phase 1 was, and gives Phase 4
a head start on its own scope instead of starting from zero.
