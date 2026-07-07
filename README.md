# Prologue

Game 1 of a 5-part single-player offline saga — an open-world 2D action RPG
with Dragon Ball Z's tonal DNA (original IP). Vanilla JS + canvas, zero
dependencies.

- Design: [docs/PROPOSAL.md](docs/PROPOSAL.md)
- Build plan + stage evidence: [docs/STAGES.md](docs/STAGES.md)

## Run

Serve the repo root statically and open `index.html`:

```
python3 -m http.server 8080   # or any static server
```

## Test

```
npm run smoke
```

Headless, dependency-free. Includes the golden replay-fingerprint test — the
determinism gate every build stage must pass.
