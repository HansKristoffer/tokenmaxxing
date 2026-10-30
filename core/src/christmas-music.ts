import type { Theme } from "./themes.ts";

/**
 * Christmas's two tracks (`FESTIVE_THEMES.christmas`), written for this game. The square's is a sleigh-ride in
 * G major: a lead that climbs the chord and falls back, over a "ding" bass, with a hat on every off-beat for the
 * bells. The Tavern's is a julefrokost polka in D: kick and snare oom-pah under a bouncy tune that ends each
 * phrase with a tipsy step down. 64 steps each (eight bars of eight).
 */
export const CHRISTMAS_TOWN: Theme = {
  id: "festive-christmas-town",
  name: "Sleighbell Standup",
  emoji: "🎄",
  bpm: 132,
  wave: "square",
  lead: "g5 _ b5 d6 g6 _ d6 b5 | a5 _ c6 e6 a6 _ e6 c6 | b5 _ d6 g6 f#6 _ d6 b5 | g5 _ _ _ d6 _ . . | e6 _ d6 c6 b5 _ g5 a5 | b5 _ a5 g5 f#5 _ a5 c6 | b5 d6 g6 d6 b5 a5 g5 f#5 | g5 _ _ _ g5 _ . .",
  bass: "g3 . d4 . g3 . d4 . | c3 . g3 . c3 . g3 . | g3 . d4 . d3 . a3 . | g3 . d4 . g3 . . . | c3 . g3 . g3 . d4 . | d3 . a3 . d3 . a3 . | g3 . d4 . d3 . a3 . | g3 . d4 . g3 . . .",
  drums: "k.hhs.hh | k.hhs.hh | k.hhs.hh | k.hhs.hs | k.hhs.hh | k.hhs.hh | k.hhs.hh | k.hhs.ks",
};

export const CHRISTMAS_TAVERN: Theme = {
  id: "festive-christmas-tavern",
  name: "Julefrokost Polka",
  emoji: "🍻",
  bpm: 148,
  wave: "square",
  lead: "d6 _ a5 f#5 d5 _ f#5 a5 | g5 _ b5 _ d6 _ b5 g5 | a5 _ c#6 e6 a6 _ e6 c#6 | d6 _ _ _ a5 _ . . | f#5 g5 a5 b5 a5 f#5 d5 _ | g5 a5 b5 d6 b5 g5 e5 _ | a5 _ a5 g5 f#5 e5 d5 e5 | d5 _ _ _ d5 _ . .",
  bass: "d3 . a3 . d3 . a3 . | g3 . d4 . g3 . d4 . | a3 . e4 . a3 . e4 . | d3 . a3 . d3 . . . | d3 . a3 . d3 . a3 . | g3 . d4 . e3 . b3 . | a3 . e4 . a3 . e4 . | d3 . a3 . d3 . . .",
  drums: "k.s.k.s. | k.s.k.s. | k.s.k.s. | k.s.k.ss | k.s.k.s. | k.s.k.s. | k.s.k.s. | k.s.ksks",
};
