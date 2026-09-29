/** A chat line made only of emoji bursts around its author instead of showing a bubble. */

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The emoji in `text` (one per grapheme, so 👍🏽 and 🧑‍💻 stay whole), or null if it has anything else. */
export function emojiOnly(text: string): string[] | null {
  const parts = [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== "");
  const isEmoji = (s: string) =>
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);
  return parts.length > 0 && parts.length <= 8 && parts.every(isEmoji) ? parts : null;
}

export const BURST_MS = 1800;
