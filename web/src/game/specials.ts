/**
 * The Inn's chalkboard: one special a day, the same for everyone because the day is Copenhagen's.
 * The days walk the list with a stride that shares no factor with its length, so every special comes
 * round once before any comes back.
 */
export const SPECIALS = [
  "🍝 Soup of the day: spaghetti code",
  "🥞 Fresh off the stack: overflow pancakes",
  "🍻 Happy hour: 2-for-1 on merge conflicts",
  "🍲 Chef's pick: race condition ragù, served whenever it's ready",
  "🍜 Null pointer noodles. Hold the reference.",
  "☕ Bottomless coffee, bottomless backlog",
  "🐟 Catch of the day: an unhandled exception",
  "🍟 Side order: deep-fried legacy code",
  "🍨 Rubber duck sundae, debugged to order",
  "🍔 The Tokenburger: 200k context, extra cheese",
  "🥔 Breakfast all day: hash browns (SHA-256)",
  "🌭 Off the grill: hot-reloaded sausages",
  "🔥 Today's roast: your last PR",
  "🥗 Vegan option: tree-shaken salad",
  "🥬 From the salad bar: lettuce rebase",
  "🧊 Cold brew, served with a cold start",
  "🥐 Cached croissants (stale after 5 minutes)",
  "🍱 Lunch combo: monolith, microservices on the side, extra latency",
  "🍷 House red: a full-bodied 2019 node_modules",
  "🔤 Alphabet soup, all in camelCase",
  "🌾 Gluten-free: semicolon-free JavaScript",
  "🥧 Pie of the day: 3.14159 slices, rounding errors included",
  "🍳 Off-by-one omelette: 11 eggs. Or 13.",
  "📐 Espresso, YAML-indented. One space off and it's tea.",
  "🥯 Fresh bagels, now with dependency injection",
  "🍣 Sushi: raw SQL, hand-rolled",
  "🫖 Kombucha, fermenting since the last major version",
  "🚀 Friday special: deploys on us",
  "🍞 Toast. Works on my machine.",
  "✅ The usual: it compiles, ship it",
  "🥚 Brunch: async eggs, awaited forever",
  "🌋 Burnt toast, aka production at 3am",
  "🫒 Tapas: small PRs, easy to review",
  "🥤 Smoothie: every branch blended, no squash",
  "❓ Mystery meat: a regex nobody remembers writing",
  "🍪 Prompt cookies, freshly baked (no tracking)",
  "♾️ Ramen: infinite loop noodles. Slurp responsibly.",
  "🧇 Waffles with exactly one well-documented edge case",
  "🧀 A well-aged TODO from 2021",
  "🥩 Prime rib, with a side of composite numbers",
  "♨️ Leftovers: yesterday's stack trace, reheated",
  "🍕 Pizza by the token: 8 slices, a million tokens each",
  "🍫 Hot chocolate, hotfixed, with marshmallows",
  "🍵 Decaf only. The build already keeps you up.",
  "🔁 Free refills on retries (exponential backoff applies)",
  "🍸 Mocktail: a mocked mock in a test of a test",
  "🧂 A pinch of salt, for the product estimates",
  "🥜 Peanut gallery: code review comments, salted",
  "🐛 Bug-free brownies (we haven't looked very hard)",
] as const;

/** Through the whole list before a repeat: shares no factor with its length (checked in the tests). */
export const STRIDE = 17;

const COPENHAGEN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Copenhagen",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Copenhagen's date at `at`, as days since 1970-01-01. */
export const copenhagenDay = (at: Date): number =>
  Math.round(Date.parse(`${COPENHAGEN.format(at)}T00:00:00Z`) / 86_400_000);

/** The special on Copenhagen's date at `at`. */
export const specialOn = (at: Date): string => SPECIALS[(copenhagenDay(at) * STRIDE) % SPECIALS.length]!;
