import type { Theme } from "./themes.ts";

/**
 * Befrielsen's music (`festive.ts`): slow and sparse, a candle's worth of notes. The town track is a soft triangle
 * wave at 66 bpm in D minor that turns to D major in its second half and ends on the tonic, hopeful and unhurried,
 * with a heartbeat of a kick and almost nothing else. The Tavern's is the same evening an hour later: E minor
 * opening into G major, a little warmer, a hushed brush on the hat. Written for this game.
 */

export const BEFRIELSEN_TOWN: Theme = {
  id: "festive-befrielsen-town",
  name: "Lys i vinduet",
  emoji: "🕯️",
  bpm: 66,
  wave: "triangle",
  lead: "d5 _ _ _ f5 _ a5 _ | g5 _ _ _ f5 _ e5 _ | bb4 _ d5 _ f5 _ e5 _ | a4 _ _ _ _ _ . . | d5 _ f#5 _ a5 _ _ _ | b5 _ _ _ a5 _ g5 _ | e5 _ g5 _ a5 _ f#5 _ | d5 _ _ _ _ _ . .",
  bass: "d3 _ _ _ a3 _ _ _ | g2 _ _ _ d3 _ _ _ | bb2 _ _ _ f3 _ _ _ | a2 _ _ _ e3 _ _ _ | d3 _ _ _ a3 _ _ _ | g2 _ _ _ d3 _ _ _ | a2 _ _ _ e3 _ _ _ | d3 _ _ _ a2 _ _ _",
  drums: "k....... | ........ | k....... | ........ | k...h... | ........ | k...h... | ....h..h",
};

export const BEFRIELSEN_TAVERN: Theme = {
  id: "festive-befrielsen-tavern",
  name: "Et lys i glasset",
  emoji: "🕯️",
  bpm: 92,
  wave: "triangle",
  lead: "e5 _ g5 _ b5 _ a5 g5 | e5 _ _ _ d5 _ e5 _ | g5 _ a5 _ b5 _ d6 _ | b5 _ a5 _ _ _ . . | g5 _ _ b5 d6 _ b5 _ | c6 _ b5 _ a5 _ g5 _ | a5 _ b5 _ c6 _ a5 _ | g5 _ _ _ _ _ . .",
  bass: "e3 . b3 . e3 . b3 . | c3 . g3 . c3 . g3 . | g3 . d4 . g3 . d4 . | d3 . a3 . d3 . a3 . | g3 . d4 . g3 . d4 . | c3 . g3 . c3 . g3 . | d3 . a3 . d3 . a3 . | g2 . d3 . g2 . . .",
  drums: "k...h... | ....h... | k...h... | ....h..h | k...h... | ....h... | k...h... | ....h.hh",
};
