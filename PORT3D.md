# Porting the 2D town to the 3D demo

Base: PR #70 (`web/src/demo3d`). Reference 2D code (read-only):
- `/Users/nicholaserlin/tokenmaxxing` (branch feat/tavern): Tavern, basement, dorm, quests, badges, card.
- `/tmp/pr2` (branch pr/company-house): offices v2, desks, posters, furniture, merch.
- main-line 2D code is in both (core/src, web/src/art, web/src/game).

## Rules
- Each slice lives in NEW files under `web/src/demo3d/` (prefix named per slice). Touch shared files
  (`main.ts`, `room.ts`, `town.ts`, `furniture.ts`, `avatar.ts`, `kit.ts`) only with tiny additive edits, or not at all;
  the integrator wires slices in. `furniture.ts` `light()` and `panel.ts` `panel()` are shared helpers.
- Props are `Asset`s (`furniture.ts`): `{ id, name, price, w, d, build, seat?, bed? }`. Use the 2D catalog id as `id`
  (tile props: `tile:<char>`). Export `export const <SLICE>_ASSETS: readonly Asset[]`.
- Do not import from tavern-only core files that this base lacks; if you need 2D data (maps, catalogs, prices),
  copy it into `web/src/demo3d/data/<slice>.ts` as a plain snapshot with a comment naming the source file.
- Match the demo's look: `Model` boxes/cyls/balls, `toon` colours, `glow` for emissives, `ticks` for animation,
  night lights via `light()`. Must render in both HD and Pixel styles.
- Verify: `bun run typecheck` (+ lint if configured) in your worktree, add a catalog/stage hook so the work is visible,
  and screenshot it (`bun --port=<yours> web/demo3d.html`, preview tools). Commit on your branch; do not push.
- Report: files added, ids covered, what's left, screenshot paths. Keep it under 300 words.
