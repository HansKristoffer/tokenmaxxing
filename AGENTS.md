# tokenmaxxing

A multiplayer town for people who run AI coding agents: a Bun server with Rivet actors (`server/`), the game
in 2D canvas and 3D (`web/`), the rules both share (`core/`) and a Tauri desktop app (`app/`).
[ARCHITECTURE.md](ARCHITECTURE.md) says how it fits together. [docs/development.md](docs/development.md) has
setup, server config, QA, releases and production; the sections below point into it.

## Checks

`bun run check` is what CI runs: typecheck, lint and tests. The tests start their own servers.

## Looking at the game

The QA scripts (`scripts/qa/`) drive the real game in headless Chromium. Playwright is a devDependency.
Details and measured frame rates: [QA scripts](docs/development.md#qa-scripts).

- `bun run qa:serve` starts this checkout's server on its own port and prints the origin; the QA scripts
  find it by themselves. The game is bundled when the server starts, so run it again after every change to
  `web/` or `server/`.
- `bun run qa:stop` stops this checkout's server. Other worktrees run theirs at the same time: stop a
  server with this command, never with `pkill`.
- `bun run qa:modals` screenshots every modal, on the 2D and the 3D skin, into `.data/qa/modals/`.
- Headless, the High and Ultra tiers draw 1 to 2 frames a second and a click takes 5 to 10 s. For HUD and
  modal work, `holdStill(page)` from `scripts/qa/lib.mjs` gives 60; for a check that needs the 3D world
  moving, use `medium`.

Scratch files (a plan, a ledger) go in `.plans/`, which git ignores.

## Releases and production

- PR titles are Conventional Commits. release-please keeps a Release PR open, and merging it is the
  release: [Releases](docs/development.md#releases).
- Railway deploys every merge to `main`, a Release PR included, and a new deploy replaces one that is still
  starting. A merge waits until the previous deploy has finished; the command that says so, and where the
  logs are read (Railway's dashboard), are in [Production](docs/development.md#production).
