import { setup } from "rivetkit";
import { arcade } from "./arcade.ts";
import { match } from "./match.ts";
import { player } from "./player.ts";
import { town } from "./town.ts";
import { world } from "./world.ts";

/** RivetKit reads RIVET_RUN_ENGINE_PORT too; tests move it off the dev server's port. */
export const ENGINE_PORT = Number(process.env.RIVET_RUN_ENGINE_PORT ?? 6420);

/**
 * One process runs everything: RivetKit starts the engine on localhost and
 * `main.ts` exposes only the client gateway through its own server.
 */
export const registry = setup({
  use: { town, player, world, arcade, match },
  startEngine: true,
  engineHost: "127.0.0.1",
  enginePort: ENGINE_PORT,
  startServices: false,
  noWelcome: true,
  // A sync batch is up to 1000 events (~300 KB of JSON); the default cap is 64 KB.
  maxIncomingMessageSize: 1024 * 1024,
  // Rejected actions (a taken name, say) log as warnings: noise. The native side reads
  // RIVET_LOG_LEVEL from the real environment instead (see package.json and the Dockerfile).
  logging: { level: "error" },
  // ponytail: one process holds the engine and every actor, so a deploy restarts both and
  // there's never an old runner to drain. Bump this if actors ever run on more than one host.
  envoy: { version: 1 },
  // Railway waits a few seconds after SIGTERM; the default grace is the engine's 30 minutes.
  shutdown: { gracePeriodMs: 5_000 },
});

export type {
  BoardCompany,
  BoardPlayer,
  CompanyProfile,
  GamePlayer,
  Leaderboard,
  Listing,
  Me,
  MyCompany,
  Profile,
  Today,
  Wallet,
} from "./town.ts";
