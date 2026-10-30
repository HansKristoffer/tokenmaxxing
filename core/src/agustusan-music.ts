import type { Theme } from "./themes.ts";

/**
 * Agustusan's music (`themes.ts` `FESTIVE_THEMES`): both written for this game, in the town's 64-step note format.
 * The town's is a kroncong-flavoured march: a bell-bright lead on a major-pentatonic scale that leans on gamelan-style
 * interlocking pairs of notes (the kotekan, where two players share one fast line), a plucked cak-cuk bass that
 * bounces root and fifth off the beat, and a kendang (drum) that answers with a tak between the dungs.
 * The Tavern's is dangdut: faster, a minor pentatonic with a suling-like hook, and the dang-dut kendang that gave it its name.
 */

/** The square: C pentatonic (c d e g a), 112 bpm, bright and marching. */
export const AGUSTUSAN_TOWN: Theme = {
  id: "festive-agustusan-town",
  name: "Merah Putih Pagi",
  emoji: "🇮🇩",
  bpm: 112,
  wave: "triangle",
  lead: "g5 . e5 g5 a5 . g5 e5 | d5 . e5 g5 e5 _ d5 . | g5 . e5 g5 a5 . c6 a5 | g5 _ e5 _ d5 _ . . | c6 . a5 c6 d6 . c6 a5 | g5 a5 c6 _ a5 g5 e5 . | d5 e5 g5 a5 g5 e5 d5 e5 | e5 g5 c6 _ c6 _ . .",
  bass: "c3 . g3 . c3 . g3 g3 | g2 . d3 . g2 . d3 d3 | c3 . g3 . a2 . e3 . | g2 . d3 . g2 . g3 . | f2 . c3 . f2 . c3 c3 | c3 . g3 . c3 . g3 . | g2 . d3 . g2 . b2 . | c3 . g3 . c3 _ . .",
  drums: "k.hskhs. | k.hskhs. | k.hskhs. | k.hskhss | k.hskhs. | k.hskhs. | k.hskhs. | k.hsksss",
};

/** The Tavern: A minor pentatonic (a c d e g), 132 bpm, a dangdut dance. */
export const AGUSTUSAN_TAVERN: Theme = {
  id: "festive-agustusan-tavern",
  name: "Dangdut Tujuh Belas",
  emoji: "🪘",
  bpm: 132,
  wave: "square",
  lead: "a4 c5 e5 a5 g5 e5 d5 c5 | d5 e5 g5 e5 d5 c5 a4 . | a4 c5 e5 a5 c6 a5 g5 e5 | g5 e5 d5 c5 a4 _ . . | e5 _ g5 a5 c6 _ a5 g5 | a5 g5 e5 g5 a5 _ . . | d5 e5 g5 a5 g5 e5 d5 c5 | a4 c5 e5 a5 _ _ . .",
  bass: "a2 . a3 . e3 . a3 . | g2 . g3 . d3 . g3 . | a2 . a3 . e3 . a3 . | e2 . e3 . b2 . e3 . | d3 . d4 . a3 . d4 . | a2 . a3 . e3 . a3 . | g2 . g3 . d3 . g3 . | a2 . a3 . e3 _ . .",
  drums: "ks.kks.. | ks.kks.. | ks.kks.. | ks.kks.s | ks.kks.. | ks.kks.. | ks.kks.. | ks.kkssk",
};
