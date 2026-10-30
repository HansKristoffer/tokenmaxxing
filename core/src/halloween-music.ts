import type { Theme } from "./themes.ts";

/**
 * Halloween's two tracks (`FESTIVE_THEMES.halloween`, `themes.ts`), original, in A harmonic minor (the G sharp is the
 * creepy leading tone): the town's is a slow music-box lurch, a hollow triangle lead climbing the minor triad over a
 * bass that creaks between A and E; the Tavern's is a wicked little jig, fast and sawtooth, with a chromatic fall
 * in the second half like a skeleton down the cellar stairs.
 */

// A: the haunted music box up the triad and down; B: the answer, climbing to the G sharp and not quite resolving.
// biome-ignore format: a score reads best eight steps a bar
export const HALLOWEEN_TOWN: Theme = {
  id: "festive-halloween-town",
  name: "Trick or Treat.exe",
  emoji: "🎃",
  bpm: 100,
  wave: "triangle",
  lead: "a4 _ c5 _ e5 _ c5 . | a4 _ c5 _ e5 _ g#5 . | f5 _ e5 _ c5 _ a4 . | b4 _ d5 _ e5 _ g#5 _ | a5 _ g#5 a5 e5 _ c5 . | d5 _ f5 _ a5 _ f5 . | e5 _ g#5 _ b5 _ g#5 e5 | a5 _ _ _ e5 _ . .",
  bass: "a2 . e3 . a2 . e3 . | a2 . e3 . a2 . c3 . | f2 . c3 . f2 . c3 . | e2 . b2 . e2 . g#2 . | a2 . e3 . a2 . e3 . | d3 . a2 . d3 . a2 . | e2 . b2 . e2 . g#2 . | a2 . e3 . a2 _ . .",
  drums: "k...h... | k...h..h | k...h... | k..hs..h | k...h.h. | k..hs.h. | k...h.hh | k.h.s.hs",
};

// biome-ignore format: a score reads best eight steps a bar
export const HALLOWEEN_TAVERN: Theme = {
  id: "festive-halloween-tavern",
  name: "Skeleton Jig",
  emoji: "💀",
  bpm: 148,
  wave: "sawtooth",
  lead: "a4 c5 e5 a5 g#5 e5 c5 e5 | f5 a5 c6 a5 f5 e5 d5 _ | a4 c5 e5 a5 b5 g#5 e5 g#5 | a5 _ e5 _ a4 _ . . | c6 b5 bb5 a5 g#5 g5 f#5 f5 | e5 _ g#5 _ b5 _ e6 _ | d6 c6 b5 a5 f5 a5 d6 _ | e6 _ d6 _ c6 b5 a5 _",
  bass: "a2 . e3 . a2 . e3 . | f2 . c3 . d3 . a2 . | a2 . e3 . a2 . e3 . | e2 . b2 . e2 . g#2 . | a2 . c3 . a2 . c3 . | e3 . g#2 . e3 . b2 . | d3 . f3 . d3 . a2 . | e2 . e3 . a2 _ . .",
  drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.hks.hs | k.h.s.h. | k.h.s.hh | k.hks.h. | kkhks.ss",
};
