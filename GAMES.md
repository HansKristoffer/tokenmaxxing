# Plan: mini games

Players challenge each other to small games inside the world and play for coins. We build **one universal
system** first:
- **tables**: one kind of game lobby, which you can invite people to *and* leave open for anyone to join;
- a match runner;
- coin stakes and payouts.

Then **every game is one file of pure rules**. The first three games prove the system works for every shape:
- **Ship, Pivot, Raise**: a 1v1 duel with hidden, simultaneous moves. It's the simplest, so it's the one the
  system is built and tested with.
- **Hype Cycle**: a real-time crash game for 2–8 players. Cash out before the valuation crashes.
- **Due Diligence**: Liar's Dice for 2–6 players, turn-based, with hidden dice, bluffing and calling "Liar!".
- **Tokenmaxxing**: the house game. Pick how long the battle runs; whoever burns the most tokens by the end
  wins. Your moves are your real AI usage. The progress is live in the game, in the menu bar, and on a
  scoreboard over the players in the world.

Adding a third game later should mean one rules file and one React component. It should need no server
changes.

## Decisions (defaults; change them before we build)

1. **You bet coins, and every bet is zero-sum.** See *Betting* below.
   - Everyone at a table puts in the same stake. The winners take the pot, split the way the host chose.
   - People watching can put side bets on who wins.
   - After a game, the players can agree to a double-or-nothing rematch.
   - The town never adds coins, so two friends playing each other a hundred times can't create coins.
   - **No town cut.** The pot goes to the players in full.
   - **No house prize.** The town never pays anyone for winning; stakes are the only prize.
2. **You play in a panel, and the players gather in the world.** See *In the world* below.
   - The game itself runs in a panel over the world.
   - Meanwhile the players' avatars gather around a game table in the town square, under a banner saying
     what they're playing. Everyone passing by sees it and can walk up to watch or bet.
   - A physical arcade (machines in the town square that open the lobby) is a later add-on. It would reuse
     the same lobby.
3. **Each match is its own actor, `match[id]`.**
   - It holds the players, the game state and a timer. It lives exactly as long as the game.
   - One broken or busy match can't slow down the world or other matches.
4. **A new `arcade["main"]` actor handles the social side and the money:**
   - tables and their invites;
   - who is in which match;
   - stakes, until the match settles.

   The `world` actor stays about positions and chat.
5. **Game rules are pure functions in `core/src/games/`.** The server runs them to decide what's allowed.
   The client imports the same types and helpers, and the tests need no server.
6. **One game at a time per player.** You can't sit at a table while you're at another one or in a
   match.
7. **One lobby concept: the table.** Every game starts as a table, whatever the game or player count:
   - **The host invites people.** Each one gets a request they can accept (which seats them) or decline. A
     1v1 "challenge" is just a 2-seat table with one invite.
   - **The table is open or private.** An open table is visible to everyone, in the Arcade panel and as a 🎮
     sign over the host in the world, and anyone can take a free seat. A private table only takes the
     people invited.
   - **Invites and open seats work together.** For example, a Hype Cycle for 6 where the host invites 2
     friends and leaves the last 3 seats open.
   - The table starts when it's full, or when the host presses Start with at least `min` players seated.

## How it works

```
 host ──open table──► arcade["main"] ──invite──► friends ──accept──┐
                     (tables, invites,  ──listed──► everyone ──join────┤ each seat holds its stake
                      escrow, who plays what)                          ▼ (town ledger)
                                        full, or host starts ──► match[id] ◄── players connect
                                                   (rules from core/src/games, timer, per-player views)
                                                     │ result            │ start / end
                                                     ▼                   ▼
                                                   arcade ──settle──► town ledger (pot to the winners)
                                                   arcade ──gather / release──► world (avatars at a game table)
```

### The game interface: `core/src/games/types.ts`

Every game is one object:

```ts
export interface GameDef<State, Move, View> {
  id: GameId;                    // "spr" | "hype" | "dice" | …
  name: string;                  // "Ship, Pivot, Raise"
  blurb: string;                 // one line for the lobby
  players: { min: number; max: number };
  /** Real-time games get `tick` every `tickMs`; turn-based games leave both out. */
  tickMs?: number;
  /** Choices the host makes when opening a table, with their allowed values (Tokenmaxxing's duration). */
  options?: Record<string, readonly (string | number)[]>;
  /** Usage games: your synced tokens are your moves. Called with each synced event's tokens and time. */
  usage?(state: State, player: number, tokens: number, at: number): State;
  /** Long games (Tokenmaxxing) let players walk around meanwhile; short ones hold them at the table. */
  holdPlayers?: boolean;
  /** Seeded, so a match can be replayed and tested. */
  setup(players: number[], seed: number, options: Record<string, string | number>): State;
  /** A player's move: the new state, or a reason it's refused (shown to that player). */
  move(state: State, player: number, move: unknown, now: number): State | { refused: string };
  tick?(state: State, now: number): State;
  /** What one player may see; hides what they mustn't (the other player's pick before the reveal). */
  view(state: State, player: number): View;
  /** Null while playing; then the players ranked, where ties share a place. */
  result(state: State): { places: number[][] } | null;
  /** Optional: what just happened, said out loud in the world ("Liar!", "💥 crashed at ×3.4"). */
  callouts?(before: State, after: State): { player: number | null; text: string }[];
}
```

- `move` gets `unknown` and must check it itself, like every action does today.
- The registry `GAMES: Record<GameId, GameDef>` is the only list of games. The lobby, the server and the
  client all read it.
- Everything is data: state and views are plain JSON, so actor state and events carry them unchanged.

### Actor `arcade["main"]`

**State (persisted):**
- `tables`: one per game waiting to start. Each has:
  - `id`, `host`, `game`, `stake`, `seats` (from 2 up to the game's `max`) and `open` (true or false);
  - `seated: userId[]`;
  - `invited: { userId, expiresAt }[]`: each invite lasts 2 minutes.
- `playing`: `userId → matchId`.

A table closes (and returns every stake) when the host leaves, or after 10 minutes without starting.

**Actions:**

| Action | Who | What |
|---|---|---|
| `open(game, { stake, seats, split, open, invite: userId[], options })` | player | Open a table. You take the first seat and your stake is held. Invites go out at once. A "challenge" is `open("spr", { seats: 2, open: false, invite: [ada] })` |
| `invite(tableId, userIds)` | the host | Invite more people, up to the free seats. Rate limited: 10 a minute |
| `answer(tableId, yes \| { counter: stake })` | someone invited | Yes: hold their stake and seat them. No: tell the host. A counter offer goes to the host |
| `takeCounter(tableId, userId)` | the host | Accept a counter offer: re-price the table and seat them |
| `watch(matchId)` / `bet(matchId, playerId, coins)` | anyone not playing | Watch a match, and put one side bet on one of its players while bets are open |
| `rematch(matchId)` | a player in a finished 1v1 | Ask for double or nothing. When both have asked, the new match starts |
| `join(tableId)` | anyone | Take a free seat at an **open** table: hold the stake and seat them |
| `leave(tableId)` | someone seated | Return their stake. If it's the host, the table closes |
| `start(tableId)` | the host | Start once at least `min` are seated. A full table starts by itself |
| `lobby()` | player | Open tables (game, host, seated/seats, stake), plus the tables you're invited to |
| `finished(matchId, places)` | `match` only | Pays out the pot and the side bets, frees the players, and tells the world |

All checks happen here: the stake fits the balance; you aren't already at a table or in a match; the seat is
free; the table is open or you were invited. Accepting an invite or joining when the table just filled gets a
friendly "that table just filled".

**Events:**
- `invite { table }` goes to the one invited. It's shown as a toast with Accept and Decline.
- `answer { table, userId, yes }` goes to the host.
- `table { table }` goes to everyone seated, whenever someone joins or leaves.
- `lobby { tables }` goes to every connection when the list of open tables changes. The lobby and the
  signs in the world stay live without polling.
- `start { matchId }` goes to each player.

### Actor `match[id]`

- **Created by `arcade`**, with input `{ game, players, stake, seed }`.
- **Connections** are checked like everywhere else. Only the match's players may connect, and later
  spectators may too, with a read-only view.
- **Actions:** `move(m)` runs `def.move`. On success, each player gets their own `view` as a `state` event.
- **Run loop:** real-time games get `def.tick` every `tickMs`. Every game gets the time limits below.
- **The end.** When `def.result` is final, the match tells `arcade.finished(places)`, shows the result for
  10 seconds, and then lets the actor sleep for good.
- **Time limits:**
  - Someone who doesn't move for 30 seconds in a turn-based game loses that round.
  - Someone who is disconnected for 20 seconds forfeits the match.
  - The match itself has a hard limit (5 minutes for a duel). After it, the current leader wins, or everyone
    gets their stake back.
- **Long matches survive deploys.** The match's state lives in the actor, like everything else, so a server
  restart in the middle of a 24-hour Tokenmaxxing battle picks up where it left off. The deadline is a
  timestamp, not a countdown in memory.

### In the world: players gather at a game table

When a match starts, its players leave wherever they were and gather together in the town square, so the
world shows there's a game on.

- **Where.**
  - `arcade` asks `world.gather(matchId, players, label)`.
  - `world` picks a free spot in the town square, always, even when every player is in the same company
    house, so every game is public. It's the nearest open 3×3 patch of walkable tiles, starting from the host
    if the host is in town, otherwise from the middle of the square, and it never overlaps another game or a
    wall.
  - The middle tile gets a **game table**. It's drawn in code like the rest of the art, with a look per game:
    a card table for Due Diligence, a small screen with a rising line for Hype Cycle, a desk with a bell for
    Ship, Pivot, Raise.
- **Who stands where.**
  - The players warp in with the usual warp animation and stand on the tiles around the table, facing it.
  - A duel puts the two players on opposite sides. Up to 8 players fill the ring.
  - Players in company houses or the Inn are moved to town for the match. Doors don't matter.
- **The state.**
  - Players in a match get a new `PlayerState`: `playing`. They can't walk away while it lasts; the arrow
    keys do nothing, and the panel has **Forfeit**.
  - They don't get sent to bed for being idle, since the match has its own time limits.
  - Being in a game isn't being away.
- **Everyone else sees:**
  - **A banner** over the table, for example `🎮 Hype Cycle · 🪙 150 pot · 👀 4`. Clicking it opens the match
    to watch, and to bet while side bets are open.
  - **The players** at the table, each with a small 🎮 tag instead of the usual state, and the game's live
    status over their heads where it makes sense: 🪂 ×3.1 once they cashed out, 🎲 ×3 for the dice they have
    left, ✓ when they've picked.
  - **Callouts** as speech bubbles from the players, from the game's optional `callouts`. For example
    "Liar!", "💥 crashed at ×3.4", "Ship beats Raise".
  - **The end** is a 🪙 burst around the winners and a line in the room's chat: "ada won 🪙 150 at Hype
    Cycle".
- **Afterwards.**
  - `arcade` calls `world.release(matchId)`: the table disappears and the players go back to `idle`, still
    standing there. The crowd can chat about the game, and the double-or-nothing rematch sits at the same
    table.
  - Where they were before the game is remembered, the same way as for resting. Pressing **Back** in the
    end screen (or the first arrow key within 10 seconds) takes them back there.
- **State in `world`:** `games: { matchId → { room, x, y, game, label, players } }`.
  - It's sent in `snapshot` to people in that room, and changes arrive as `game` events.
  - It's small, the tick doesn't touch it, and a restart can rebuild it by asking `arcade` which matches are
    running.

### Coins: a ledger in `town`

Today the balance is worked out as usage coins minus purchases. Games need coins to move between players, so
we add one table:

```sql
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,          -- negative: coins out
  kind TEXT NOT NULL,               -- 'stake' | 'payout' | 'refund' | 'bet' | 'winnings'
  ref TEXT NOT NULL,                -- 'table:<id>' for stakes, 'bets:<id>' for side bets
  at INTEGER NOT NULL)
```

- `balance = usage coins + podium coins − purchases + SUM(ledger.amount)`.
- New internal actions on `town`:
  - `hold(userIds, stake, ref)` takes the stake from everyone, or from nobody if one of them can't afford it.
    It runs through `serial`, so it can't overspend.
  - `settle(ref, payouts)` pays the pot.
  - `refund(ref)` gives every stake back.
- **Checks on the ledger:**
  - Every `ref` (a table's stakes, or its side bets) sums to 0 once it's settled. The rest of a split pot goes to the best-placed player, the
    lowest user id first.
  - Every stake is always either held, paid out or refunded; a test checks this.
- The wallet shows recent games ("+120 won a duel against ada").

### Betting: stakes, side bets and double or nothing

Every coin that moves goes through the ledger above, is held the moment it's bet, and is either paid out or
refunded. Nothing is ever created.

**Stakes: what the players bet.**
- **Choosing the stake.** The host picks it when opening the table: 0 (just for fun), 10, 50, 100, 250 or a
  custom amount.
  - The cap is 500, and never more than half your balance, so one bad game can't wipe you out.
  - Everyone who sits down pays the same stake. The table shows it before you join ("🪙 50 to play · pot
    🪙 150 so far").
- **Choosing the split** (tables with 3 or more seats):
  - **Winner takes all**;
  - **Top 3**: 60/30/10, which needs at least 4 players;
  - **Top half**: the pot is split evenly among the better half.

  Two-player tables are always winner takes all. A tie splits the pot evenly between the tied players, and a
  remainder goes to the best-placed, then to the lowest user id.
- **Counter offers.** When invited, you can answer "yes, but for 🪙 20" instead of accepting. The host sees
  the counter and can take it: the table's stake changes, and anyone already seated gets the difference back,
  or confirms paying more. It's handy when a friend can't afford the stake. Only while nobody else has joined
  keeps this simple.
- **Leaving:**
  - Leave a table before it starts and you get your stake back.
  - Leave a match, or stay disconnected for 20 seconds, and you forfeit: you're placed last and your stake
    stays in the pot.
- **The pot is visible everywhere.**
  - The sign over the host shows it (`🎮 Hype Cycle 3/6 · 🪙 150 pot`).
  - The match frame shows the pot and each player's cut if the game ended now.
  - The end screen pays out with a 🪙 burst around the winners in the world, the same emoji burst as chat.

**Side bets: what the audience bets.**
- **Watching.** Anyone can watch a running match. Spectators see what everyone sees: `view(state, null)`,
  which never shows hidden picks.
- **Betting.** While a table is waiting, and for its first 10 seconds of play, anyone who isn't playing can
  back one player with 1 to 200 coins.
- **Payout: a shared pool (parimutuel).**
  - All side bets on a match go into one pool.
  - When it ends, the people who backed the winner split the whole pool in proportion to what they bet. The
    live odds are shown: "ada ×1.8 · bo ×2.4".
  - If nobody backed the winner, or the match is cancelled, every side bet is refunded.
  - With a split pot (a tie or top 3), the side-bet pool is shared across the backers of everyone in the
    first place.
- **Rules that keep it fair:**
  - Players can't bet on their own match.
  - One bet per person per match.
  - Bets close before the game gets far enough to make it a sure thing.
- **In the world.** A 👀 counter next to the match's players, and "bo won 🪙 90 backing ada" in the room's
  chat.

**Double or nothing: after a 1v1.**
- The end screen offers **Rematch for 🪙 100** (twice the stake, still capped).
- If both press it within 20 seconds, a new private table opens with both seated and the new stake held, and
  the match starts at once.
- If one declines, or can't afford it, it just says so. Nothing is held until both have said yes.

**Stats and bragging rights:**
- **Player cards** show games played, the win rate, net coins from games, and the biggest pot won.
- **A new "Games" tab on the leaderboard** has three rankings, by range: *most coins won*, *best win rate*
  (at least 10 games), and *biggest pots*.
- **A daily "Biggest pot" line** in the town square chat, when a pot over 🪙 500 is won.

**Limits, all on the server:**
- A stake can't be more than 500, or more than half your balance.
- A side bet can't be more than 200, and there's one per match.
- You can be at one table or match at a time.
- Invites are rate-limited to 10 a minute.
- Tables close after 10 minutes without starting, with everything refunded.

### The client

- **Invite someone.** Every player card gets a 🎮 **Invite to a game** button. It opens the new-table form
  with that player already invited. This is the 1v1 challenge.
- **Open a table.** The same form, from the Arcade panel:
  - the game;
  - the seats (for a 1v1 game there's only 2);
  - the stake (0, 10, 50, 100 or custom);
  - **Open to everyone**, a switch, on by default;
  - people to invite, found by name (like @mentions).
- **Your table.** While it waits, a small card shows the seats: filled, invited (⏳) or free. It has **Invite**,
  **Start** (for the host) and **Leave**.
- **An invite toast.** It reads "ada invites you to Hype Cycle · 3/6 seated · 🪙 50", with **Accept**,
  **Decline** and a 2-minute countdown. It uses the existing toast, with buttons added.
- **The 🎮 Arcade panel** is a new HUD button next to 🪙. The button shows how many open tables there are.
  - **Invited:** tables you're invited to, at the top, with Accept and Decline.
  - **Open tables:** game, host, seated/seats, stake, and a **Join** button.
  - **Open a table:** the form above.
- **Open tables in the world.** An open table shows a sign over its host, for example
  `🎮 Hype Cycle 3/6 · 🪙 50`. Clicking the sign opens the table so you can join, the same way clicking a
  player opens their card. People passing by see there's a game to join.
- **The match panel.**
  - A shared frame shows the game name, the players with their avatars, the pot, a timer and a forfeit
    button.
  - The game's own component sits inside, at `web/src/games/<id>.tsx`. It gets `{ view, move }`: the view to
    draw and a function to send a move.
  - At the end, the frame shows the placings and the coins won.
- **In the world.** Players in a match gather around a game table in the town square, under a banner. See
  *In the world* above.

## The first games

### Ship, Pivot, Raise (1v1, the duel)

This is rock-paper-scissors for founders:
- **Ship** beats **Raise**: traction beats a deck.
- **Raise** beats **Pivot**: money buys time.
- **Pivot** beats **Ship**: the market moved.

- It's best of 5 rounds.
- Both players pick in secret. `view` hides the other player's pick until both have picked, then both see the
  reveal for 2 seconds.
- 15 seconds per pick; missing one loses the round.
- It tests the parts of the system that matter most: hidden information, simultaneous moves, rounds and
  timeouts.

### Hype Cycle (2–8 players, real-time)

A crash game: the valuation climbs until it crashes, and the question is how long you dare stay in.
- **A round.**
  - After a 3-second countdown, the valuation multiplier starts at ×1.00 and climbs: `m(t) = e^(t/12)`,
    which is ×2 after about 8 seconds, ×5 after 19 and ×10 after 28.
  - At a secret moment it crashes.
  - Everyone presses **Cash out** whenever they dare. Your score for the round is the multiplier you cashed
    out at. If you're still in when it crashes, you score 0.
- **A match** is 3 rounds. The highest total wins, and the pot is paid out with the split the host picked.
  If everyone crashes out in every round, the stakes are refunded.
- **The crash point.**
  - It's drawn from a seeded distribution, like the classic crash game: `crash = max(1, 0.99 / (1 − u))`,
    capped at ×50. Half of all rounds crash before about ×2, and a few run past ×20.
  - **Provably fair.** Before each round, every player sees `sha256(seed)`. After the crash, the seed
    itself is shown, so anyone can check the crash point wasn't changed mid-round.
- **Real time, cheaply.**
  - The server sends the round's start time once. Clients animate the curve themselves from `m(t)`.
  - The server decides everything: a cash out counts at the multiplier for the moment it *arrives*, and the
    crash is sent the moment it happens.
  - The crash point is never in any view until the crash. This is the "tick" path: the match's run loop
    checks for the crash every 50 ms.
- **For the audience.**
  - Everyone watching sees the same rising curve, who has cashed out (a 🪂 with their multiplier), and who is
    still in.
  - It's the best game for side bets, which close 10 seconds into the first round.

### Due Diligence (2–6 players, turn-based)

Liar's Dice, where the dice are your startup's metrics:
- **Each round.**
  - Everyone rolls their dice in secret. You start with 5.
  - 🦄 (the 1) is a **unicorn**: it's wild and counts as any face.
  - Players take turns making a claim about **all** the dice on the table: "at least seven 4s".
- **Your turn.** Either **raise** or call **"Liar!"**.
  - A raise is a higher quantity of any face, or the same quantity of a higher face. You can't claim unicorns
    themselves.
  - Calling "Liar!" reveals every die.
    - If the table has at least what was claimed (unicorns included), the caller loses a die.
    - If not, the one who made the claim loses a die.
  - The loser starts the next round.
- **The end.** Run out of dice and you're out. The last founder with dice wins, and places go in reverse
  order of elimination, for the host's split.
- **Time limit.** 30 seconds per turn. Time out and you lose a die, and a new round starts.
- **What each player sees.**
  - Your own dice and how many dice everyone has.
  - The claims so far, in order.
  - After a call, everyone's dice for 4 seconds, with the matching faces highlighted.
- **For the audience.** Spectators see what the players see, minus the hidden dice, until the reveal. The
  claims and the "Liar!" calls make it easy to follow.

### Tokenmaxxing (2–12 players, your real usage)

The game the town is named after: burn the most tokens in the time you agreed on.

- **Opening a table.** The host picks the **duration**: 15 minutes, 30 minutes, 1 hour, 4 hours or 24 hours.
  The stake, the split, invites and open seats work like every other table. The invite reads "ada challenges
  you to Tokenmaxxing · 1 hour · 🪙 100".
- **The score.**
  - It's the tokens in events stamped inside the battle: input, output, cache writes and cache reads, the
    same as the leaderboard.
  - Everything used before the start doesn't count, however late it syncs.
  - Events keep being deduplicated by message id, as they are today.
- **Joining** needs the menu bar app to be running and signed in. The table shows "✓ syncing" or
  "⚠️ app not running" next to each seated player, based on their last sync.
- **The countdown.** The battle starts on the minute, after a 1-minute countdown, so everyone gets time to
  fire up their agents.
- **Live progress.**
  - During a battle, the app syncs every **10 seconds** instead of every 2 minutes. `player.ingest` answers
    with `battleUntil`, and the helper speeds up until then.
  - After each ingest, `player` sends `arcade.usage(userId, [{ tokens, at }])`. `arcade` passes it to the
    match, and the game's `usage` adds it up.
  - The match pushes the standings (at most one update a second) to everyone watching, and to `world` for
    the scoreboard.
  - Between updates, clients animate the numbers towards the latest value, so the counters tick smoothly.
- **The end.**
  - When the time is up there's a **3-minute grace period** ("⏳ counting the last tokens…"). A sync that
    arrives late still counts, but only for events stamped before the end.
  - Then the placings are final and the pot is paid out.
  - Ties are exact: players with the same tokens share a place.
- **Side bets** close after the first 10% of the battle (at most 10 minutes), so late bets can't just back
  whoever is clearly winning.
- **The game panel** shows:
  - a big countdown and the pot;
  - each player's line: avatar, tokens, tokens per minute, and a bar towards the leader;
  - a live chart of cumulative tokens per player (drawn as a plain SVG);
  - "🔥 +12.4M in the last minute" when someone surges.
- **The menu bar app** shows a battle line while you're in one: "🏁 Tokenmaxxing · 2nd · 18:42 left ·
  412M". Clicking it opens the world at the battle. This matters because people battle from their editor,
  not the world.
- **Fair play.**
  - Tokens come from your own logs, the same trust as the leaderboard today.
  - A battle refuses a sync that claims more than 50M tokens in a minute for one player, and flags it on
    the scoreboard. `ponytail:` a fixed cap; tune it from real battles.

#### Tokenmaxxing in the world: the arena and its scoreboard

A battle can last an hour or a day, so the players aren't stuck at a table. Instead the battle gets an
**arena** in the town square:

- **The arena.**
  - It's the same kind of free spot as other games, but wider. There's a desk with a laptop for each player,
    in an arc facing a big **scoreboard** on a post.
  - The scoreboard is drawn every frame in the world:
    - "🏁 TOKENMAXXING · 18:42 left · 🪙 300 pot";
    - the players ranked, each with a tokens counter that ticks up live and a bar in their colour;
    - a 👑 on the leader;
    - "⏳ counting…" during the grace period.
- **Where players are.**
  - While a battle runs, a player's **rest spot is their arena desk** instead of their bed or company desk.
  - Offline, idle or just running agents, they sit at the arena desk typing, with the 💻 ×N agents tag that
    already exists.
  - Online players can still walk around town. A small "🏁 2nd · 412M" tag follows them, and they sit back
    down at the arena when they rest. That's the same rest system as today, with a different rest spot.
- **Battling feels alive.**
  - Each player's laptop screen at the arena flickers faster the more tokens per minute they burn.
  - When someone takes the lead, they get a callout ("🔥 ada takes the lead!") and the 👑 moves.
  - At the end the winner gets a 🪙 burst, and the scoreboard stays for a minute showing the final standings.
- **Clicking the scoreboard** opens the battle panel to watch, and to bet while bets are open.

## Tests

| File | What it covers |
|---|---|
| `core/test/games/spr.test.ts` | Who beats whom, best of 5, a missed pick loses the round, the view hides the other pick until the reveal |
| `core/test/games/hype.test.ts` | The multiplier curve, cash outs count at arrival, crashed players score 0, 3-round totals, the crash point is never in a view before the crash, `sha256(seed)` matches the revealed seed, everyone crashing refunds |
| `core/test/games/dice.test.ts` | Legal and illegal raises, unicorns count as wild, calling "Liar!" takes a die from the right player, elimination order becomes places, timeouts, each view shows only your own dice until the reveal |
| `core/test/games/registry.test.ts` | Every game: seeded setup is deterministic, `result` is null until the end, refused moves don't change state |
| `server/test/arcade.test.ts` | Invite → accept → full → match; decline; invite expiry; private tables refuse strangers; open tables take anyone; invites and open seats together; the host starts early; the host leaving closes the table and refunds; busy players; a short balance can't stake; a race for the last seat |
| `server/test/ledger.test.ts` | Hold, settle and refund: each match sums to 0, splits and remainders add up, two holds can't overspend |
| `core/test/games/payouts.test.ts` | Splits (all, top 3, top half), ties, remainders, the parimutuel pool with its odds, refunds when nobody backed the winner. All pure functions |
| `server/test/betting.test.ts` | Stake caps (500, half your balance), counter offers, forfeits keeping the stake in the pot, side bets closing on time, no betting on your own match, double or nothing only when both agree and both can pay |
| `server/test/match.test.ts` | A full duel through actions; forfeit on disconnect; hard time limit refunds or pays the leader |
| `core/test/games/tokenmaxxing.test.ts` | Only tokens stamped inside the battle count, late syncs within the grace period count, ties share a place, the per-minute cap flags a player, the duration options are honoured |
| `server/test/tokenmaxxing.test.ts` | A real battle through `player.ingest`: tokens reach the match, standings are pushed, `ingest` answers with `battleUntil`, the arena desk becomes the rest spot, the pot is paid after the grace period |
| `core/test/games/gather.test.ts` | Finding a free 3×3 spot (near the host, never on walls or another game), seats around the table facing it, a duel on opposite sides. All pure functions over the town map |
| `server/test/world.test.ts` (more) | `gather` moves players from any room to the table as `playing`; they can't step away; they don't go to bed while playing; `release` frees them; **Back** returns them to where they were; a snapshot shows the table and banner |

## Order of work (one commit each)

1. **The ledger in `town`**, with `hold`, `settle` and `refund`, and the wallet reading it. Nothing uses it
   yet.
2. **The game interface, the registry and Ship, Pivot, Raise**, as pure rules with their tests.
3. **The `match` actor**, driven by any `GameDef`, with timers and forfeits, and tested against Ship, Pivot,
   Raise.
4. **The `arcade` actor with tables**: open, invite, answer, join, leave and start, holding stakes,
   starting a match and settling it. Invites and open seats are the same code path, so both are built
   and tested here.
5. **The client.** The invite button on player cards, the new-table form, the invite toast, your table's
   card, the Arcade panel with open tables, the signs over hosts in the world, the match panel frame, the
   Ship, Pivot, Raise component, and the 🎮 tag.
6. **Gathering in the world.** `world.gather` and `world.release`, the `playing` state, the table sprites,
   the banner, the tags, callouts as bubbles, the 🪙 burst at the end, and **Back**.
7. **Live lobby.** Push `lobby` events so open tables and signs update without polling.
8. **Betting extras:** watching a match, side bets with live odds, counter offers, double or nothing, and
   the 🪙 burst on payout.
9. **Game stats:** stats on player cards and the Games tab on the leaderboard.
10. **Hype Cycle**: its rules, the crash tick, the provably-fair seed, and its component with the rising
   curve.
11. **Due Diligence**: its rules and its component with dice, claims and the reveal.
12. **Tokenmaxxing**:
    - the usage input path: `player.ingest` → `arcade.usage` → the match;
    - the helper's fast sync;
    - game options (the duration);
    - the grace period;
    - the arena with its live scoreboard, and the arena desk as the rest spot;
    - the battle line in the menu bar app.
13. **Docs.** A section in `ARCHITECTURE.md`, a line in the README, and a "how to add a game" checklist.

Steps 1–5 give playable duels for stakes, both invited and open. Step 6 puts every game on show in the
town. Steps 8–9 turn betting into a spectator sport. Steps 10–11 add the multiplayer games on top, and none
of them change the core. Step 12 extends the core once, with game options and usage as input, and every
usage game after it (a "most PRs in a day" race, say) reuses that.

## Adding a game later (the checklist this plan should make true)

1. Write `core/src/games/<id>.ts`, which exports a `GameDef`, and add it to `GAMES`.
2. Write `web/src/games/<id>.tsx`, a component that takes `{ view, move }`, and optionally the table's
   look in `web/src/art/tables.ts`.
3. Write `core/test/games/<id>.test.ts`.

It needs no server changes, no new actions and no new database tables.

## Later (the system must not block these)

- **A physical arcade** in the town square: machines that open the lobby, and a trophy shelf of today's
  winners. Open tables could also appear there.
- **Invite a whole company** at once, from the company panel.
- **Game stats** on player cards: wins, losses, coins won.
- **Company tournaments**: brackets built from tables.
- **More games:**
  - **Term Sheet** (Split or Steal, 1v1): it needs a rule for when both steal, since there's no town cut to
    send the pot to.
  - **Runway** (Farkle, push your luck).
  - **Burn Rate** (blackjack between players).
  - **Unicorn** (highest unique number wins).
  - **A coin flip** at the fountain.
  - **Prompt Race** (a typing race).
  - Tic-tac-toe, a fishing contest at the pond, and fighting "Rate Limit" in the tall grass.

## Built (2026-09-29)

All 13 steps are in; `ARCHITECTURE.md` describes what exists. Where the build differs from the plan above:
- `outcome` returns `{ places }` or `{ void: why }`; a void game refunds every stake and side bet.
- Usage games don't add deltas: `usageWindow` says which events count, and after each sync the match pulls the
  player's total for the window (`usage(state, player, { tokens, flagged })`), so late and re-sent events
  can't double count. Every minute is capped at 50M and flagged instead of the sync being refused.
- The helper learns about a battle from `arcade.battle` (asked after each sync), not from `ingest`. The menu bar
  app has no battle line any more: it's just an **Open world** button.
- `headline` and `endsAt` drive the banner over a table ("Round 3 · 2–1", a countdown).
- Game stats are all time on player cards; the Games board ranks by range.
- Not built yet: easing between Tokenmaxxing updates, and "✓ syncing" next to seated players.

## Decided (2026-09-29)

- **Stakes only:** there's no house prize. Every coin a winner gets came from the other players.
- **Betting limits:** a stake is at most 500 and at most half your balance; a side bet is at most 200.
- **No town cut:** the pot goes to the players in full.
- **The first games:** Ship, Pivot, Raise (the duel the system is built with), Hype Cycle, Due Diligence and
  Tokenmaxxing.
- **Every game gathers in the town square,** company games included, so every game is public and anyone can
  watch.
- **You play in a panel over the world.** A physical arcade in the town square comes later and reuses the
  same lobby.

Nothing is left to settle before building: start with step 1.
