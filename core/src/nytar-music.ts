import type { Theme } from "./themes.ts";

/**
 * Nytårsaften's two tracks (`FESTIVE_THEMES.nytar`), written for this game. The town's is a brass-bright fanfare in
 * G with a pumping bass and four on the floor that climbs, in its seventh bar, a scale up to the top of the register
 * and stops on a held note: the countdown. The Tavern's is an oom-pah polka in C for singing "skål" to.
 * Type-only import from `themes.ts` (it imports this for the registry).
 */

export const NYTAR_TOWN: Theme = {
  id: "festive-nytar-town",
  name: "Nedtælling til Midnat",
  emoji: "🎆",
  bpm: 132,
  wave: "square",
  lead: "d6 _ d6 b5 g5 _ b5 d6 | e6 _ e6 c6 g5 _ c6 e6 | d6 _ b5 g5 b5 _ d6 g6 | f#6 _ e6 d6 a5 _ . . | b5 _ e6 _ g6 _ e6 b5 | c6 _ e6 _ a6 _ e6 c6 | a5 b5 c6 d6 e6 f#6 g6 a6 | b6 _ a6 _ f#6 _ . .",
  bass: "g2 . d3 . g2 . d3 . | c3 . g3 . c3 . g3 . | g2 . d3 . g2 . d3 . | d3 . a3 . d3 . a3 . | e3 . b3 . e3 . b3 . | a2 . e3 . a2 . e3 . | d3 d3 d3 d3 d3 d3 d3 d3 | d3 . a3 . d3 . . .",
  drums: "khkhshkh | khkhshkh | khkhshkh | khkhshks | k.h.s.h. | k.h.s.h. | ksksksss | k.s.ksss",
};

export const NYTAR_TAVERN: Theme = {
  id: "festive-nytar-tavern",
  name: "Skål for Nytåret",
  emoji: "🥂",
  bpm: 152,
  wave: "square",
  lead: "c5 e5 g5 e5 c6 _ g5 . | b4 d5 g5 d5 b5 _ g5 . | c5 e5 g5 e5 c6 _ e6 . | d6 b5 g5 b5 d6 _ . . | a5 c6 f6 c6 a5 _ f5 . | g5 c6 e6 c6 g5 _ e5 . | d5 g5 b5 d6 g6 _ d6 b5 | c6 _ g5 _ c6 _ . .",
  bass: "c3 . g3 . c3 . g3 . | g2 . d3 . g2 . d3 . | c3 . g3 . c3 . g3 . | g2 . d3 . g2 . d3 . | f3 . c4 . f3 . c4 . | c3 . g3 . c3 . g3 . | g2 . d3 . g2 . d3 . | c3 . g3 . c3 . . .",
  drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.hks.hs",
};
