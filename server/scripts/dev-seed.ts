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
const suffix = Date.now().toString(36).slice(-4);

const events = (sessions: number, minutes: number, perTurn: number): TokenEvent[] => {
  const out: TokenEvent[] = [];
  const start = Date.now() - minutes * 60_000;
  for (let s = 0; s < sessions; s++)
    for (let t = start; t < Date.now(); t += 60_000)
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
  return out;
};

const people = [
  { name: `anna${suffix}`, sessions: 4, minutes: 90, perTurn: 40_000 },
  { name: `bo${suffix}`, sessions: 2, minutes: 60, perTurn: 20_000 },
  { name: `cy${suffix}`, sessions: 1, minutes: 30, perTurn: 5_000 },
  { name: `dee${suffix}`, sessions: 0, minutes: 0, perTurn: 0 },
];

const made = [];
for (const p of people) {
  const u = await anon.signUp(p.name);
  const token = { params: { token: u.token } };
  const e = events(p.sessions, p.minutes, p.perTurn);
  for (let i = 0; i < e.length; i += 1000)
    await client.player.get([String(u.userId)], token).ingest(e.slice(i, i + 1000));
  made.push({
    ...u,
    town: client.town.getOrCreate(["main"], token),
    player: client.player.get([String(u.userId)], token),
  });
}
const co = await made[0]!.town.createCompany(`Arox ${suffix}`);
await made[1]!.town.apply(co.id);
await made[0]!.town.approve(made[1]!.userId);
await made[2]!.town.createCompany(`Solo ${suffix}`);

const code = await made[0]!.player.mintLoginCode();
console.log(`Signed up ${made.map((m) => m.name).join(", ")}.`);
console.log(`Open ${origin}/#code=${code}`);
console.log(`Device token for ${made[0]!.name} (for the helper): ${made[0]!.token}`);
process.exit(0);
