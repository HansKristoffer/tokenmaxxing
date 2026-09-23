# tokenmaxxing

A menu bar leaderboard for AI coding agents. Install the app, pick a name, and create or join a
**group** with a shareable code. Your leaderboard shows everyone you share at least one group with:
tokens, cost, and **parallelism**, meaning how many agents you run at once.

Reads usage from Claude Code (including subagents), Claude Cowork, Codex and Cursor.

## Install

```bash
brew install --cask hanskristoffer/tap/tokenmaxxing
```

Open **Tokenmaxxing** and pick a name. Then open *Groups* in the menu bar to create a group and
copy its invite, or paste a friend's code (`K7QM-2XRP-9D`).

## What's shared

Only **token counts, model names, timestamps and opaque session/message ids** leave your Mac. Message
content never does. The app reads local logs:

| Source | Where |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (subagents included) |
| Claude Cowork | `~/Library/Application Support/Claude/…/.claude/projects/**/*.jsonl` |
| Codex | `~/.codex/sessions/**/*.jsonl` |
| Cursor | `~/.cursor/projects/**/agent-transcripts`, `state.vscdb` (token counts are estimated) |

You can turn any source off in Settings. Your groupmates see your totals, cost, models and daily
activity. People you don't share a group with see nothing.

## The stats

- **Tokens:** input + output + cache writes + cache reads.
- **Cost:** priced from [LiteLLM's table](https://github.com/BerriAI/litellm), refreshed daily.
- **Parallelism ×:** the average number of agents running at the same time, measured over the time you
  had at least one running. Three agents working through the same hour is 3.0×. Time is measured in
  5-minute buckets, subagents count as agents, and you need at least 1 active hour in the range to be
  ranked.
- **Peak agents:** the most agents running at once.
- **Tokens / active hour:** tokens divided by hours with at least one agent running.

## How it works

```
Tokenmaxxing.app                                     server (Railway)
├─ Swift menu bar UI  ◄─ NDJSON ─►  TS helper  ──HTTPS──►  Bun + Hono + SQLite
│  Keychain, login item             parses local logs       groups, leaderboard, dashboard
```

| Path | What |
|---|---|
| `core/` | Log parsers, sync engine (`collect` → `send`), shell↔helper protocol types |
| `server/` | Hono API + `bun:sqlite`; serves the dashboard from `web/` |
| `web/` | React dashboard (bundled by Bun at startup, no Vite) |
| `app/helper/` | The TypeScript helper the app runs (`bun build --compile`) |
| `app/macos/` | SwiftUI `MenuBarExtra` shell (Swift Package, no Xcode project) |
| `app/scripts/build-app.sh` | Assembles, signs and notarizes `Tokenmaxxing.app` |
| `packaging/tokenmaxxing.rb` | Homebrew cask template |

## Development

Requires Bun 1.4+ and Xcode 16+ (macOS 14+).

```bash
bun install
bun run dev:server                     # http://localhost:8787 (data in ./.data)
bun run app:dev                        # builds the app against localhost and opens it
bun run check                          # typecheck + lint + tests
swift test --package-path app/macos    # Swift protocol contract test
```

In `app:dev` builds the helper runs from source, so TypeScript changes only need an app restart.
To sync without the UI:

```bash
TOKENMAXXING_TOKEN=… TOKENMAXXING_SERVER_URL=http://localhost:8787 bun run helper:once
```

### Server config

| Var | Default | |
|---|---|---|
| `PORT` | `8787` | |
| `TOKENMAXXING_DATA_DIR` | `/data` in production, `./.data` in dev | SQLite lives here, so mount the Railway volume at `/data` |
| `TOKENMAXXING_DB` | `$DATA_DIR/tokenmaxxing.sqlite` | |
| `NODE_ENV` | | `production` turns on secure cookies and production bundling |

### Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (PR titles are checked).
[release-please](https://github.com/googleapis/release-please) keeps a Release PR open. Merging it
tags the version, builds and notarizes the app for arm64 and x86_64, attaches the zips, and updates the
cask in `HansKristoffer/homebrew-tap`. Railway deploys the server from `main`.

Required repo settings: the variable `TOKENMAXXING_SERVER_URL`, and the secrets `MACOS_CERT_P12`,
`MACOS_CERT_PASSWORD`, `MACOS_SIGN_IDENTITY`, `NOTARY_APPLE_ID`, `NOTARY_TEAM_ID`,
`NOTARY_PASSWORD` and `HOMEBREW_TAP_TOKEN`.

## License

MIT. Based on [anaralabs/tokenleader](https://github.com/anaralabs/tokenleader).
