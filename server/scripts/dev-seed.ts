/**
 * Fills a local world with a few people for development: `bun run dev` in one
 * terminal, then `bun run dev:seed`. Prints a link that signs you in as the first.
 */
import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import { createClient } from "rivetkit/client";
import type { registry } from "../src/actors/registry.ts";

const origin = process.env.TOKENMAXXING_SERVER_URL ?? "http://localhost:8787";
const client = createClient<typeof registry>({ endpoint: `${origin}/api/rivet` });
const anon = client.town.getOrCreate(["main"]);
// Names and session ids get a suffix so that a second seed run does not reuse the first one's accounts.
const suffix = Date.now().toString(36).slice(-4);

const events = (sessions: number, minutes: number, perTurn: number): TokenEvent[] => {
  const out: TokenEvent[] = [];
  const start = Date.now() - minutes * 60_000;
  for (let s = 0; s < sessions; s++) {
    for (let t = start; t < Date.now(); t += 60_000) {
      out.push({
        source: "claude_code",
        sessionId: `seed-${suffix}-${s}`,
        agentId: null,
        messageId: `seed-${suffix}-${s}-${t}`,
        requestId: null,
        timestamp: t,
        model: s % 2 ? "claude-sonnet-4-5" : "claude-opus-4-1",
        messageType: "assistant",
        inputTokens: perTurn,
        outputTokens: perTurn / 4,
        cacheCreationTokens: 0,
        cacheReadTokens: perTurn * 20,
        reasoningTokens: null,
      });
    }
  }
  return out;
};

const people = [
  { name: `anna${suffix}`, sessions: 4, minutes: 90, perTurn: 40_000 },
  { name: `bo${suffix}`, sessions: 2, minutes: 60, perTurn: 20_000 },
  { name: `cy${suffix}`, sessions: 1, minutes: 30, perTurn: 5_000 },
  { name: `dee${suffix}`, sessions: 0, minutes: 0, perTurn: 0 },
];

const signedUp = [];
for (const person of people) {
  const account = await anon.signUp(person.name);
  const token = { params: { token: account.token } };

  const usage = events(person.sessions, person.minutes, person.perTurn);
  for (let i = 0; i < usage.length; i += 1000) {
    await client.player.get([String(account.userId)], token).ingest(usage.slice(i, i + 1000));
  }

  signedUp.push({
    ...account,
    town: client.town.getOrCreate(["main"], token),
    player: client.player.get([String(account.userId)], token),
  });
}

// The first account founds a company, the second applies and is approved, the third founds one alone.
const company = await signedUp[0]!.town.createCompany(`Arox ${suffix}`);
await signedUp[1]!.town.apply(company.id);
await signedUp[0]!.town.approve(signedUp[1]!.userId);
await signedUp[2]!.town.createCompany(`Solo ${suffix}`);

const code = await signedUp[0]!.player.mintLoginCode();
console.log(`Signed up ${signedUp.map((m) => m.name).join(", ")}.`);
console.log(`Open ${origin}/play#code=${code}`);
console.log(`Device token for ${signedUp[0]!.name} (for the helper): ${signedUp[0]!.token}`);
process.exit(0);
