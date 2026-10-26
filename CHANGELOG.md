# Changelog

## [1.10.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.9.0...v1.10.0) (2026-10-26)


### Features

* **web:** add six-player poker table layout ([452ab8b](https://github.com/HansKristoffer/tokenmaxxing/commit/452ab8baa0e52c599cc335668431b3e82d95addc))
* **web:** add six-player poker table layout ([d108999](https://github.com/HansKristoffer/tokenmaxxing/commit/d1089997e6204b59728e4cae1a209fa7de5d25a1))
* **web:** steadier 3D town, a bigger square and one place to dress up ([#96](https://github.com/HansKristoffer/tokenmaxxing/issues/96)) ([fe20223](https://github.com/HansKristoffer/tokenmaxxing/commit/fe20223eafabf9f44eca57ab0ed5775900f83573))

## [1.9.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.8.2...v1.9.0) (2026-10-26)


### Features

* **android:** add companion APK with QR account pairing ([#78](https://github.com/HansKristoffer/tokenmaxxing/issues/78)) ([7e0b586](https://github.com/HansKristoffer/tokenmaxxing/commit/7e0b586f3d182956118bb970926d3e37ec63c638))
* **art:** stock the 2D shop displays with recognisable wares ([811933b](https://github.com/HansKristoffer/tokenmaxxing/commit/811933bfc98dee93401fa205bc8dc414733873f1))
* **art:** stock the 2D shop displays with recognisable wares ([1aa3982](https://github.com/HansKristoffer/tokenmaxxing/commit/1aa39820d49fa56ee78cf1e49d024eedf5086309))
* **desktop:** prepare Linux and Windows preview builds ([#77](https://github.com/HansKristoffer/tokenmaxxing/issues/77)) ([f79e687](https://github.com/HansKristoffer/tokenmaxxing/commit/f79e687c6eb9f8ec01f21e918b4174c4acefd758))
* furniture editing, physical shops, new hallways and stairs, perf and server hardening ([#79](https://github.com/HansKristoffer/tokenmaxxing/issues/79)) ([54d92eb](https://github.com/HansKristoffer/tokenmaxxing/commit/54d92ebb6f8cd22a6c0a0441dd2338e555c75630))
* **hosts:** refresh landing page for 3D town ([cc81b8c](https://github.com/HansKristoffer/tokenmaxxing/commit/cc81b8c300c3fd4bb5e923be601aa9b22aba65a5))
* **hosts:** refresh landing page for 3D town ([2c4bd8c](https://github.com/HansKristoffer/tokenmaxxing/commit/2c4bd8c9c7934d50789f823f772f38c1bdebffcb))
* **pairing:** short phone sign-in codes you can type ([c7d4a4d](https://github.com/HansKristoffer/tokenmaxxing/commit/c7d4a4d9d3e06ad54cdb635152bb868aec077462))
* **render3d:** move renderer out of demo structure ([e4dcd68](https://github.com/HansKristoffer/tokenmaxxing/commit/e4dcd68bf4d323750abe67f4786b25a744739758))
* **vite:** smooth shadows and ambient occlusion ([#82](https://github.com/HansKristoffer/tokenmaxxing/issues/82)) ([3f9cc4c](https://github.com/HansKristoffer/tokenmaxxing/commit/3f9cc4cbe553763f320863ce1cce5330b75e7d7e))


### Bug Fixes

* **android:** sign in on older WebViews, short phone codes, and leaner CI ([e123dd9](https://github.com/HansKristoffer/tokenmaxxing/commit/e123dd9dcf05efdffefe2953e63f9b9bb31b0776))
* **ci:** use fileURLToPath for the fixture path, optional chain in tournament signup ([d9f72a5](https://github.com/HansKristoffer/tokenmaxxing/commit/d9f72a5e565b00eef59c8f10c339ebd5e93834ae))
* format the pairing tests, and write the contract fixture on Windows ([26b7fc9](https://github.com/HansKristoffer/tokenmaxxing/commit/26b7fc969c06001cd2cbd4185595e9c69b66b60e))
* **web:** open rivetkit sockets as ws(s) for WebViews before Chromium 125 ([0edc1d3](https://github.com/HansKristoffer/tokenmaxxing/commit/0edc1d36ad6441d4f53547de7641441d094f0f61))

## [1.8.2](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.8.1...v1.8.2) (2026-10-24)


### Bug Fixes

* **server:** re-queue every day for card v2 in the background, not while a player starts ([#75](https://github.com/HansKristoffer/tokenmaxxing/issues/75)) ([38a5531](https://github.com/HansKristoffer/tokenmaxxing/commit/38a5531d46a7f736934b4e4014702a61ec9c2cfa))

## [1.8.1](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.8.0...v1.8.1) (2026-10-24)


### Performance Improvements

* batch the town's night glows, lighter world broadcasts, real-game perf harness ([#73](https://github.com/HansKristoffer/tokenmaxxing/issues/73)) ([2dbf70c](https://github.com/HansKristoffer/tokenmaxxing/commit/2dbf70c7b827272e511ae99be8dbbd5f97b8ec92))

## [1.8.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.7.0...v1.8.0) (2026-10-24)


### Features

* Tokenmaxxing 2.0 ([#72](https://github.com/HansKristoffer/tokenmaxxing/issues/72)) ([915505d](https://github.com/HansKristoffer/tokenmaxxing/commit/915505d6be8623a0aefcb70e485354e800580853))


### Bug Fixes

* **helper:** forget a removed computer even while the helper deletes its state ([bc59a5c](https://github.com/HansKristoffer/tokenmaxxing/commit/bc59a5cb7f5d121c9dbaa2f11943689f95005419))
* **hud:** give the legendary milestone toast its own glow ([3505043](https://github.com/HansKristoffer/tokenmaxxing/commit/3505043ff2f5a46ad742ff527e90259a2eb19828))
* **server:** close the gaps the review found in the new caches ([0f76129](https://github.com/HansKristoffer/tokenmaxxing/commit/0f76129c72bdf5e7db2671aa0364124ac9d8a12b))
* **town:** a failed sign-up's id is never handed out again ([1692f03](https://github.com/HansKristoffer/tokenmaxxing/commit/1692f03a86ba3203dcd488d69b2d17f773c1dbd0))


### Performance Improvements

* a faster, smaller codebase across server, core, web and tests ([6f25adc](https://github.com/HansKristoffer/tokenmaxxing/commit/6f25adc333fd3004b9653f73bd4cfa93f8c459a7))
* **arcade:** build each push's lobbies once ([fe0a66b](https://github.com/HansKristoffer/tokenmaxxing/commit/fe0a66b58548679e6f6d7d877ef4ccbad1f29823))
* **core:** bucket raid days without copying, and cache each day's week ([00d5933](https://github.com/HansKristoffer/tokenmaxxing/commit/00d5933ff30df3779fcb16b384fa077051479616))
* **core:** findSpot walks only each ring's edge ([601683c](https://github.com/HansKristoffer/tokenmaxxing/commit/601683c6d1066f2de2621e4c50d444f054251d01))
* **core:** keep GameMap.find's tiles per character ([801bd97](https://github.com/HansKristoffer/tokenmaxxing/commit/801bd976d7f718fa8111f1e40d148a2de5f2937e))
* **core:** list Codex's indexed rollouts with less file system work ([0318766](https://github.com/HansKristoffer/tokenmaxxing/commit/03187664adcdd0aa7b17f9a02d2d6220fef20f37))
* **core:** look items and pieces up in maps ([f5ea1ee](https://github.com/HansKristoffer/tokenmaxxing/commit/f5ea1ee768963649b45fcee6485a4adf472aa922))
* **core:** one world clock, with its UTC offset kept per hour ([eeef543](https://github.com/HansKristoffer/tokenmaxxing/commit/eeef54368490045cfb15e30f7a4224370a6c09f5))
* **core:** roll each raid kill's loot once ([9b23bc0](https://github.com/HansKristoffer/tokenmaxxing/commit/9b23bc02b312136ee5ea599385e008db5c9aa90b))
* **core:** route over typed arrays with a moving queue head ([3f5dc10](https://github.com/HansKristoffer/tokenmaxxing/commit/3f5dc10ef6cc3c0283f22e771f0dd609aee5d917))
* **core:** skip Claude Code lines that can't be events before parsing ([0529983](https://github.com/HansKristoffer/tokenmaxxing/commit/0529983e52446df5eccf79c479aed81ea4eca55b))
* **core:** skip Codex lines that can't matter before parsing ([f15f9d2](https://github.com/HansKristoffer/tokenmaxxing/commit/f15f9d21df08457dd4963d7918f485d3eb0533d0))
* **core:** stat a sync's files in batches ([294e7ad](https://github.com/HansKristoffer/tokenmaxxing/commit/294e7ad304c1cde8debc6889988f29a8ef26da1d))
* **game:** cull off-screen buildings and people; one Frame for drawing ([f0db4d1](https://github.com/HansKristoffer/tokenmaxxing/commit/f0db4d12d4c622288e1c077c7d4bcbfa2152603a))
* **hud:** fewer re-renders, refetches and redraws ([2156700](https://github.com/HansKristoffer/tokenmaxxing/commit/215670048bb628e726d94e9c6d726bb0b598815a))
* **match:** copy less of the state per tick ([82b8ac2](https://github.com/HansKristoffer/tokenmaxxing/commit/82b8ac261c6abe019fe6a187b2ce85d590066218))
* **server:** fewer queries per sync and per priced row ([762c714](https://github.com/HansKristoffer/tokenmaxxing/commit/762c7143b41762de7b205804f502cff005e6dc6c))
* **server:** one token cache for every actor, and one check per token at a time ([5eae4d9](https://github.com/HansKristoffer/tokenmaxxing/commit/5eae4d9b31a247b12f48cbcdbf30781db1b6f5b2))
* TCP_NODELAY on the engine's sockets ([f4c5eb9](https://github.com/HansKristoffer/tokenmaxxing/commit/f4c5eb9d677484be1f49380d139ded53feee327e))
* **town:** check wallets against the podiums and raids the town keeps ([72a0a2a](https://github.com/HansKristoffer/tokenmaxxing/commit/72a0a2a395f1d64e4885dec92c8a3d1b075a8974))
* **town:** keep the leaderboards until something on them changes ([68f103a](https://github.com/HansKristoffer/tokenmaxxing/commit/68f103aeaa9840489debd6233d500fedb9d4982e))
* **town:** today's corner reads only today's usage ([753e9ab](https://github.com/HansKristoffer/tokenmaxxing/commit/753e9ab0a397d0c327db8d859103512eea086ea5))
* **world:** don't rebuild or rebroadcast what didn't change ([ea148c5](https://github.com/HansKristoffer/tokenmaxxing/commit/ea148c530c5fab190997fbdd0d50803d89c9968e))
* **world:** work out who's in the houses only when it can have changed ([6f0807b](https://github.com/HansKristoffer/tokenmaxxing/commit/6f0807bc2236f12252c79411e6bfad3051698d30))

## [1.7.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.6.0...v1.7.0) (2026-10-21)


### Features

* **arcade:** Sprint Race racers run laps of the town square ([d12d440](https://github.com/HansKristoffer/tokenmaxxing/commit/d12d440fc83f259151c686b03c53ceaf5de5e1f4))
* **arcade:** Sprint Race, a typing duel ([b882b8a](https://github.com/HansKristoffer/tokenmaxxing/commit/b882b8a5feaacfa3bd3634c8ae094f65b8b1bf40))
* **arcade:** Sprint Race, a typing duel for coins ([315b549](https://github.com/HansKristoffer/tokenmaxxing/commit/315b549972f2491ab1e902234229c50ca15cda52))
* **company:** company wallet, company furniture and merch ([388fd08](https://github.com/HansKristoffer/tokenmaxxing/commit/388fd08de590f26a189f15228ebc588c1f592b57))
* **company:** company wallet, company furniture and merch ([3d35077](https://github.com/HansKristoffer/tokenmaxxing/commit/3d3507765c15f61a7e935e19e952aea98a016b49))
* **company:** wallets start at 0, and any member can spend them ([612de1d](https://github.com/HansKristoffer/tokenmaxxing/commit/612de1d7bc4f125f524a140c6eb7b17b0887c01e))
* **levels:** raise the cap to 50, with a milestone every ten levels ([f1d41d6](https://github.com/HansKristoffer/tokenmaxxing/commit/f1d41d663c4a6283871f3f01307e490371e190a7))
* **pets:** Pets v2: variations, names and a bed ([4cc2830](https://github.com/HansKristoffer/tokenmaxxing/commit/4cc2830700d1504ebe90f15bc876e94ad32f0469))
* **pets:** variations, names and a bed ([68f2294](https://github.com/HansKristoffer/tokenmaxxing/commit/68f22945bc9027570761aae412da54dd3d6b1915))
* **picnic:** touched grass for the office; cop speed limit to 200M/hour ([40d4963](https://github.com/HansKristoffer/tokenmaxxing/commit/40d4963590babd0ee2179b43ff9f341411c7f747))
* **raid:** a countdown to the first raid ([ebd3ffa](https://github.com/HansKristoffer/tokenmaxxing/commit/ebd3ffae5dc179956cbe78a549ea538e0f1bdcbe))
* **raid:** a weekly boss ladder, a dungeon where every running agent fires at it, and rare loot ([cc65b63](https://github.com/HansKristoffer/tokenmaxxing/commit/cc65b631f3574ff189d9f7ecca70ab992b7f9557))
* **raid:** a weekly ladder of bosses the whole town fights ([423104e](https://github.com/HansKristoffer/tokenmaxxing/commit/423104ee0f39d40d964d1c20200afd77a1c77740))
* **raid:** boss loot tables with fixed, auditable rolls ([4f98cb8](https://github.com/HansKristoffer/tokenmaxxing/commit/4f98cb8986e51ced655eb75b6b80e7af290ec7d1))
* **raid:** draw the loot: hats, glasses, outfits, pets and trophies ([43b7e3c](https://github.com/HansKristoffer/tokenmaxxing/commit/43b7e3cca0ad1b7317ec51b61e56d91a0016ddbb))
* **raid:** halve the coins a kill pays and cap it at 50 ([b152e33](https://github.com/HansKristoffer/tokenmaxxing/commit/b152e335c5669b94eb2ec0e2f0aacae32032a92b))
* **raid:** hand out each loot drop once, and tell the winner and the world ([fb48565](https://github.com/HansKristoffer/tokenmaxxing/commit/fb48565f7c2d6fe920696badd83f810e4de07c6f))
* **raid:** loot flies out of the boss to its winner's desk ([31c2af1](https://github.com/HansKristoffer/tokenmaxxing/commit/31c2af150922f021b92bdfc8524cdecc729a003d))
* **raid:** loot in the raid panel, the bag and the shop ([79a8f64](https://github.com/HansKristoffer/tokenmaxxing/commit/79a8f64306b6bd24cdb6e4a5088220a383c3d52a))
* **raid:** the Raid Dungeon, where everyone running agents fires at the boss ([2fa6c10](https://github.com/HansKristoffer/tokenmaxxing/commit/2fa6c10951e2259a64548eea436ab46c30273539))
* ridiculous trophies on a shelf in your office ([d3549fa](https://github.com/HansKristoffer/tokenmaxxing/commit/d3549fa435df001e818da56f1ca378cd6aa231e4))
* **shop:** a head and face pack of 39 hats, glasses, masks and beards ([2f7117c](https://github.com/HansKristoffer/tokenmaxxing/commit/2f7117c439b729af6c72f7d1184af1b575787850))
* **shop:** a wardrobe of 36 new cosmetics, with hand, back and pet slots ([cb07023](https://github.com/HansKristoffer/tokenmaxxing/commit/cb07023902e97de660c3bf277a4cdfbe862d46bd))
* the traveling merchant, with numbered limited editions ([5c8c0a3](https://github.com/HansKristoffer/tokenmaxxing/commit/5c8c0a36986e5dda4666625fd6d10b1c0f4ed09b))
* **town:** doors swing open as people walk up, and the Inn's chalkboard has a daily special ([2042122](https://github.com/HansKristoffer/tokenmaxxing/commit/2042122564f78ec2b9cf5da59a85cec42600738f))
* **town:** little things: paper, pølsevogn, snail, merchant, cop, picnic, trophies, level 50 and 75 items ([b600f1e](https://github.com/HansKristoffer/tokenmaxxing/commit/b600f1ef2bfac82b028795234d7e0f18adf509e5))
* **town:** morning paper, pølsevogn and the build snail ([56f192e](https://github.com/HansKristoffer/tokenmaxxing/commit/56f192e5b9aedbb77177bc1a6aad280fe62b4934))
* **town:** the 429 Cop pulls over the fastest burner and writes a ticket ([04278a6](https://github.com/HansKristoffer/tokenmaxxing/commit/04278a65ae875b99ecee23b78ec09fc88a3cb055))
* **town:** the rød pølse is on the house ([95ddf34](https://github.com/HansKristoffer/tokenmaxxing/commit/95ddf3403038c811f32a4c24785ce6e09e437cfb))
* **world:** Copenhagen day and night with live weather ([3d1347e](https://github.com/HansKristoffer/tokenmaxxing/commit/3d1347e81114dffb07308a66f59cff02a9e8a225))
* **world:** Copenhagen day and night with live weather ([c2b47c6](https://github.com/HansKristoffer/tokenmaxxing/commit/c2b47c6b868aef6d93f38a98c94dad9668fd9da8))
* **world:** outage picnic when Claude or OpenAI is down ([a3aa02a](https://github.com/HansKristoffer/tokenmaxxing/commit/a3aa02a7d0911e5d81ae3e7bfade7b8e37774dc4))


### Bug Fixes

* **arcade:** Sprint Race runners on the track, and a clearer clock ([54d1268](https://github.com/HansKristoffer/tokenmaxxing/commit/54d1268f348b68836856c67081ef4e0651d1296b))
* **merchant:** park the cart below the pølsevogn instead of on top of it ([2876437](https://github.com/HansKristoffer/tokenmaxxing/commit/287643747f119e1dd92a77cb5b7ce5186290f112))
* **raid:** clearer wording under the loot table ([1dcc450](https://github.com/HansKristoffer/tokenmaxxing/commit/1dcc450d29191a78bf15a1b744692df3ba7f154b))
* **raid:** each raider keeps their desk across reloads ([aff796f](https://github.com/HansKristoffer/tokenmaxxing/commit/aff796fbc064442a6460e04e2dc8cdfe7de57889))
* **raid:** kill toasts clear of the boss's name and HP ([425c69b](https://github.com/HansKristoffer/tokenmaxxing/commit/425c69b6af93c090b8dd7cd6f86975baf00f26bb))
* **raid:** loot odds stop growing at ×10, so a 0.1% drop is never above 1% ([cb4d4aa](https://github.com/HansKristoffer/tokenmaxxing/commit/cb4d4aa50e7833083baa6843a10ead909a6f8bb1))

## [1.6.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.5.0...v1.6.0) (2026-10-20)


### Features

* an inventory of items, with furniture and rewards in it ([9761919](https://github.com/HansKristoffer/tokenmaxxing/commit/9761919c7b8a5c8c2a63d106bbefaf8e88f5a57b))
* badges on the player card ([8ada2f6](https://github.com/HansKristoffer/tokenmaxxing/commit/8ada2f6b4f245042f0e1482184024c25f06cfcde))
* drop items from the bag and pick them up ([f494095](https://github.com/HansKristoffer/tokenmaxxing/commit/f4940959dff3237a868fff8e6cdbb5f786399081))
* drops in the world, and taking them ([a14428c](https://github.com/HansKristoffer/tokenmaxxing/commit/a14428c8e781e70f7114671be9daf392edc87aad))
* four daily quests paid in coins ([4cf9339](https://github.com/HansKristoffer/tokenmaxxing/commit/4cf933929562ebdf702ab4410ff151baa84c1882))
* levels to 30, offices, quests, badges, trading, and an inventory with drops ([14eac15](https://github.com/HansKristoffer/tokenmaxxing/commit/14eac15a766085c04bf70f9a5846aa814d63d9ab))
* offices are furnished by dropping; the editor goes ([c518a1d](https://github.com/HansKristoffer/tokenmaxxing/commit/c518a1d53047f50afac1406df108ee65b1ce6807))
* offices behind named doors in the company building ([b3d7aaa](https://github.com/HansKristoffer/tokenmaxxing/commit/b3d7aaa428a155436754914e169ef9006537aca1))
* personal offices in the company building from level 10 ([f6d71d0](https://github.com/HansKristoffer/tokenmaxxing/commit/f6d71d0d2010357d8715629c00aa277ef300c985))
* **quests:** two quests a day, agents at once and hours running ([0650610](https://github.com/HansKristoffer/tokenmaxxing/commit/06506102452ce756bbc729fda751393cabe9cb79))
* **sync:** read PostHog Desktop Claude Code and Codex sessions ([04871f3](https://github.com/HansKristoffer/tokenmaxxing/commit/04871f374e241192289f448f97b4055ad5583f3e))
* **sync:** read PostHog Desktop Claude Code and Codex sessions ([43ebe99](https://github.com/HansKristoffer/tokenmaxxing/commit/43ebe999fbd9633bd3b989d7627d6e7043687c65))
* trade coins and items between players ([8587029](https://github.com/HansKristoffer/tokenmaxxing/commit/85870299c29aa53c3a68c0f5af693d992982669b))
* **trades:** a trades icon beside the bag while an offer is open ([dc034cf](https://github.com/HansKristoffer/tokenmaxxing/commit/dc034cf5695d0ed2c0aac3d61170405d56805138))
* **web:** levels to 30 and rewards at 10, 20 and 30 ([ec1a0a7](https://github.com/HansKristoffer/tokenmaxxing/commit/ec1a0a7b83e2f034928b866f70c31a96b83cce80))
* **web:** the bag as a grid with a count, and items that look like themselves ([df5cb33](https://github.com/HansKristoffer/tokenmaxxing/commit/df5cb332b2a89d5b370217a7fa38346f8b498934))


### Bug Fixes

* **arcade:** release players from a game that stopped ([4db45b6](https://github.com/HansKristoffer/tokenmaxxing/commit/4db45b6a32695ef8356e046d5bf12a0cc7770378))
* **arcade:** release players from a game that stopped ([f12cabf](https://github.com/HansKristoffer/tokenmaxxing/commit/f12cabfbef969df482610b6fd97df05f15e7fead))
* **bots:** follow people far less often, and never the same person at once ([106c7bd](https://github.com/HansKristoffer/tokenmaxxing/commit/106c7bd2c826d53aee6642b3ab2287586344208f))
* **hud:** centre a list row's buttons when its text wraps ([d8bd5ac](https://github.com/HansKristoffer/tokenmaxxing/commit/d8bd5ac918eddad05732239dd273de83ba450dcf))
* review follow-ups for levels, offices, quests, badges and trading ([3bab125](https://github.com/HansKristoffer/tokenmaxxing/commit/3bab125b07c308fc2c589a180a61d1232e6fa48f))
* second review follow-ups for offices, drops and the bag ([dcdc836](https://github.com/HansKristoffer/tokenmaxxing/commit/dcdc836253e9caea53f061557645916a8329ae67))
* **server:** stop game-time errors from killing the server ([c942c4e](https://github.com/HansKristoffer/tokenmaxxing/commit/c942c4e9f832473de23ce81af50c3493f23fdf15))
* **server:** stop game-time errors from killing the server ([b781e52](https://github.com/HansKristoffer/tokenmaxxing/commit/b781e522e1bd6923bc99fff438ce47a7a635edd6))
* third review, server and core ([9e4b3c3](https://github.com/HansKristoffer/tokenmaxxing/commit/9e4b3c3b126a6fcfcc104b45d22d3971fa5813d5))
* toasts stack, and small UI follow-ups from the browser test ([2293d79](https://github.com/HansKristoffer/tokenmaxxing/commit/2293d79ad43bf54bcd81a4e67d8e4b81aabb9bb3))
* **town:** push to the world one at a time, so a closed company stays closed ([d2bf2c4](https://github.com/HansKristoffer/tokenmaxxing/commit/d2bf2c41c89abca65262c9a58fa49a4f51c738a5))
* **web:** third review, client ([f446141](https://github.com/HansKristoffer/tokenmaxxing/commit/f4461417c49ce1cb360d1087566d0664a6082b8a))


### Performance Improvements

* **web:** repaint only what a drop changed ([7689892](https://github.com/HansKristoffer/tokenmaxxing/commit/7689892a2da0de7ecd8b87437ba915ca3f9630a4))
* **world:** Inn sleepers as a count, and head counts at most once a second ([08fee54](https://github.com/HansKristoffer/tokenmaxxing/commit/08fee54045169a68bef39189ac7952be6bf45e55))
* **world:** send room head counts at most once a second ([e8277e0](https://github.com/HansKristoffer/tokenmaxxing/commit/e8277e0d161bb6b56a7fdcca6b8f6b9a64ffa4a1))
* **world:** sleepers at the Inn as a count in snapshots ([dc93745](https://github.com/HansKristoffer/tokenmaxxing/commit/dc93745a62eebd7ebcbecc4aefa66edc9807e15a))

## [1.5.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.4.2...v1.5.0) (2026-10-16)


### Features

* **sync:** count Grok Bot separately and discover Codex rollouts ([9bbf6ed](https://github.com/HansKristoffer/tokenmaxxing/commit/9bbf6ed562ef68e81603ff47a6bb6da4c098bc35))
* **web:** XP bar on the player card, and three levels before Singularity ([2791fad](https://github.com/HansKristoffer/tokenmaxxing/commit/2791fad166e9b04223d73dbaf6711f71f0428404))
* **web:** XP bar on the player card, and three levels before Singularity ([251964b](https://github.com/HansKristoffer/tokenmaxxing/commit/251964b26d683f1f2e59d7d8986c1cef602de203))

## [1.4.2](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.4.1...v1.4.2) (2026-10-05)


### Bug Fixes

* **bots:** show bot lines only as speech bubbles, not in chat ([#44](https://github.com/HansKristoffer/tokenmaxxing/issues/44)) ([7d5d1b2](https://github.com/HansKristoffer/tokenmaxxing/commit/7d5d1b23070c807a8ea876dd2bdb4e159710b1e5))
* **sync:** count missed usage and PRs, show today per source in the menu bar ([#46](https://github.com/HansKristoffer/tokenmaxxing/issues/46)) ([c80846a](https://github.com/HansKristoffer/tokenmaxxing/commit/c80846ae8084cc3bdc5477481342347f2440a6b3))

## [1.4.1](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.4.0...v1.4.1) (2026-10-03)


### Bug Fixes

* **usage:** resume excluded event cleanup in background ([b6331ba](https://github.com/HansKristoffer/tokenmaxxing/commit/b6331ba3b147b62d4d7fae71e13a5fe4c5207ab4))
* **usage:** resume excluded event cleanup in background ([67b9ab8](https://github.com/HansKristoffer/tokenmaxxing/commit/67b9ab8d0e5cc0ab21d2ac90539827e36c079e7c))

## [1.4.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.3.3...v1.4.0) (2026-10-02)


### Features

* **bots:** add town bot routines and contextual dialogue ([230031e](https://github.com/HansKristoffer/tokenmaxxing/commit/230031e72c1facfbe7ad59ea78c279d177c14a08))
* **bots:** add wandering town characters ([104e6b4](https://github.com/HansKristoffer/tokenmaxxing/commit/104e6b406420ab5c5a3823ba2682f7f786d89ff9))
* **bots:** add wandering town characters ([844a12f](https://github.com/HansKristoffer/tokenmaxxing/commit/844a12fa9b2ca370e0418c5bd0b217b3416dd310))
* **shop:** add a panda pet ([53ee954](https://github.com/HansKristoffer/tokenmaxxing/commit/53ee9546f7601d79d8159e5d4243dd86f01cc5c7))
* **shop:** add a panda pet ([de37df5](https://github.com/HansKristoffer/tokenmaxxing/commit/de37df56ee973e05f4984cbe402e1deb5fd0f803))


### Bug Fixes

* exclude Grok default and CUA bot usage ([a1a3467](https://github.com/HansKristoffer/tokenmaxxing/commit/a1a346764e2010a45eaa5c2cb3212fa647c327e6))
* fall back to historical Cursor API costs for unmatched models ([1d9b0ec](https://github.com/HansKristoffer/tokenmaxxing/commit/1d9b0ec3353eff3aad97b2c8ca431def845451dd))
* match reasoning effort variants to base model prices ([0a2551e](https://github.com/HansKristoffer/tokenmaxxing/commit/0a2551e99c727654250e8e0502facde99e667e4f))
* preserve reported Cursor costs in usage totals ([d56ba77](https://github.com/HansKristoffer/tokenmaxxing/commit/d56ba77b4f6287da8f4e0562e2979f8b6944ff29))
* price Cursor Composer and Grok with published fallback rates ([f60ab29](https://github.com/HansKristoffer/tokenmaxxing/commit/f60ab29e464a85242f80ac9a4cc30d2955e6cb9d))
* stream Cursor history backfills in larger pages ([3709f4c](https://github.com/HansKristoffer/tokenmaxxing/commit/3709f4c444798de1f7e0cfb2849eb11d0b3472f6))
* sync actual Cursor dashboard token usage ([d93ab3e](https://github.com/HansKristoffer/tokenmaxxing/commit/d93ab3e18a5547ee050467a3ad9975daf401925c))
* sync Cursor dashboard usage with consistent token pricing ([c35b460](https://github.com/HansKristoffer/tokenmaxxing/commit/c35b46070a2110baeaac3310cfa423e8b3431386))
* use shared Cursor pricing and exclude background automation ([bfcf895](https://github.com/HansKristoffer/tokenmaxxing/commit/bfcf8957850676ebae3dc621270c3242cf05f219))

## [1.3.3](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.3.2...v1.3.3) (2026-10-01)


### Bug Fixes

* **connect:** prevent match state proxy errors ([e553e7f](https://github.com/HansKristoffer/tokenmaxxing/commit/e553e7fda7fee2883094d9591b97f954409b7479))
* **connect:** prevent match state proxy errors ([5d6df84](https://github.com/HansKristoffer/tokenmaxxing/commit/5d6df84f75b566cbf65a13733c563f4e7885bcf3))
* **tunnel:** prevent token sync overload during match updates ([4ba46d5](https://github.com/HansKristoffer/tokenmaxxing/commit/4ba46d5967982d4648f73975e9d594557ccf88ee))
* **tunnel:** prevent token sync overload during match updates ([4cc5a7a](https://github.com/HansKristoffer/tokenmaxxing/commit/4cc5a7af611f11c913aa0420ba6c6dc38e519208))

## [1.3.2](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.3.1...v1.3.2) (2026-09-30)


### Bug Fixes

* **tunnel:** finish matches saved as over after restart ([7d99a82](https://github.com/HansKristoffer/tokenmaxxing/commit/7d99a82b5050055aa7c723b9a10136f654ef55cc))
* **tunnel:** finish matches saved as over after restart ([1a2e9fc](https://github.com/HansKristoffer/tokenmaxxing/commit/1a2e9fccd6c62ba3602b8a0012f3e364d288610b))

## [1.3.1](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.3.0...v1.3.1) (2026-09-30)


### Bug Fixes

* **hosts:** keep token syncs working through player delays ([f061709](https://github.com/HansKristoffer/tokenmaxxing/commit/f061709ae9c56b29c78277468e4434f1eda035f4))
* **hosts:** keep token syncs working through player delays ([72ba106](https://github.com/HansKristoffer/tokenmaxxing/commit/72ba1062aebd5eea26c7cf7f7078441c5d47c1dd))
* **usage:** coalesce token sync and battle updates ([d30d76a](https://github.com/HansKristoffer/tokenmaxxing/commit/d30d76a44dc8ca3d58867999fb65aa39c0c6c794))
* **usage:** keep token totals synced through retries ([b4f8a63](https://github.com/HansKristoffer/tokenmaxxing/commit/b4f8a63ea32869142d6b6331b9c593b147e0555c))
* **usage:** keep token totals synced through retries ([d84bd32](https://github.com/HansKristoffer/tokenmaxxing/commit/d84bd3248832792992f0cea44e742d955f4a036c))

## [1.3.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.2.0...v1.3.0) (2026-09-30)


### Features

* **admin:** add authenticated game management dashboard ([c3bbe4b](https://github.com/HansKristoffer/tokenmaxxing/commit/c3bbe4bc0486658bbbd2898972a4ca05e711ca1d))
* **admin:** add authenticated game management dashboard ([ab8280d](https://github.com/HansKristoffer/tokenmaxxing/commit/ab8280daf9531e142ee4c0400c90d20431f4141e))
* **connect:** link computers to sync usage across devices ([4b04d01](https://github.com/HansKristoffer/tokenmaxxing/commit/4b04d01d14db754f5342e605128b0a9be7e2159e))
* **connect:** link computers to sync usage across devices ([6706314](https://github.com/HansKristoffer/tokenmaxxing/commit/6706314c0cd08c8834686c7bc01d298d996db5dd))

## [1.2.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.1.0...v1.2.0) (2026-09-29)


### Features

* **coffee:** add stackable coffee and avatar shaking ([c247e82](https://github.com/HansKristoffer/tokenmaxxing/commit/c247e82bd7e6e1ad134b574d87f238866de7025b))
* **coffee:** add stackable coffee and avatar shaking ([6183610](https://github.com/HansKristoffer/tokenmaxxing/commit/6183610f878b1cf0cc2b272559d01354e4009bb4))
* **coins:** count earnings from signup day ([3f2f186](https://github.com/HansKristoffer/tokenmaxxing/commit/3f2f18608f49ad639d325412df8de8cae0397401))
* **coins:** count earnings from signup day ([06f2d04](https://github.com/HansKristoffer/tokenmaxxing/commit/06f2d04d3adedb64f585bb8a2a8e8c4cdb18dd33))
* **desktop:** open game links in the system browser ([7823cda](https://github.com/HansKristoffer/tokenmaxxing/commit/7823cda659a18960ad498b825150b54edbb846b6))
* **web:** add match chat, jumping, and sharper company logos ([7c6d13c](https://github.com/HansKristoffer/tokenmaxxing/commit/7c6d13c4e8e11087f69fb9e7dba88643fecf85cf))
* **web:** add match chat, jumping, and sharper logos ([a7d0e43](https://github.com/HansKristoffer/tokenmaxxing/commit/a7d0e4326499163bc2c732d8e695c398b53534a3))
* **world:** keep idle players present in town ([51e8026](https://github.com/HansKristoffer/tokenmaxxing/commit/51e8026509e1e1bef54b01e2b9aac7e37b421be5))
* **world:** keep idle players present in town ([23a8681](https://github.com/HansKristoffer/tokenmaxxing/commit/23a86810c6861e4b54e73944c95597b7a692428d))


### Bug Fixes

* **web:** keep the desktop link handler type-safe ([f56e0cf](https://github.com/HansKristoffer/tokenmaxxing/commit/f56e0cf7d76a0d4831a297bd3214bd2784f80039))

## [1.1.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.0.2...v1.1.0) (2026-09-29)


### Features

* **desktop:** move sign-in into the game window ([3a417bd](https://github.com/HansKristoffer/tokenmaxxing/commit/3a417bde1e881bcd82c824d021d799ef823a0f94))
* **desktop:** move sign-in into the game window ([34a8d74](https://github.com/HansKristoffer/tokenmaxxing/commit/34a8d74eebe3dd78ff8f49a4625a819c21067f19))


### Bug Fixes

* **server:** let the app and browsers through to the game in production ([5dd720b](https://github.com/HansKristoffer/tokenmaxxing/commit/5dd720bd1ac20e418ce551b41827984571e02a27))
* **server:** let the app and browsers through to the game in production ([a576838](https://github.com/HansKristoffer/tokenmaxxing/commit/a57683869491b6d6eb5a49dd89ef3a64abf6d9f9))

## [1.0.2](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.0.1...v1.0.2) (2026-09-29)


### Bug Fixes

* **desktop:** no more freeze from the menu, and opening the app opens the game ([13dfabe](https://github.com/HansKristoffer/tokenmaxxing/commit/13dfabe0257769c83cb8530ab73cd9e186884d1a))
* **desktop:** no more freeze from the menu, and opening the app opens the game ([0f62bf1](https://github.com/HansKristoffer/tokenmaxxing/commit/0f62bf1481ac0dede119a6690f524050db333827))

## [1.0.1](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.0.0...v1.0.1) (2026-09-29)


### Bug Fixes

* **desktop:** save the signing identity with its letters intact ([e997f33](https://github.com/HansKristoffer/tokenmaxxing/commit/e997f339d5f2f00c9fb32fdd1445193c7629cd85))
* **desktop:** save the signing identity with its letters intact ([7350ab4](https://github.com/HansKristoffer/tokenmaxxing/commit/7350ab408df6ba35aedce69551c1341726dd989b))

## [1.0.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.5.0...v1.0.0) (2026-09-29)


### ⚠ BREAKING CHANGES

* the menu bar app is now the Tauri desktop app, with the game in its own window.
* **app:** the menu bar app is just an Open world button
* a new backend with no migration. Accounts and groups are not carried over: people sign up again from the updated app, which re-syncs their full history from local logs. The 0.4 app can't talk to this server.

### Features

* a marketing site at the root, and the game at /play ([3a766f3](https://github.com/HansKristoffer/tokenmaxxing/commit/3a766f3f333b7174c4462d01926b0e10092915e3))
* a page for every company, like a player's card ([a578e69](https://github.com/HansKristoffer/tokenmaxxing/commit/a578e69e43c1e1f1fce41b4f8d18afe2d9507211))
* a pixel-art app icon, a tiny world struck by lightning ([3122a97](https://github.com/HansKristoffer/tokenmaxxing/commit/3122a97317077610cf41b0d42f7b2dd4e219771a))
* apply to join a company, and the owner accepts or declines ([6803c18](https://github.com/HansKristoffer/tokenmaxxing/commit/6803c18364f35da7e7b5007958eb74500671f691))
* **app:** the menu bar app is just an Open world button ([5656d64](https://github.com/HansKristoffer/tokenmaxxing/commit/5656d645946b3d4b2e2ffcf46681d4d900e03a7a))
* **app:** trim the menu bar to a mini leaderboard and Open world ([508c9e1](https://github.com/HansKristoffer/tokenmaxxing/commit/508c9e1d167821cca8253a0f61e5014b979871b5))
* **core:** the game interface, payouts, and Ship, Pivot, Raise ([a50d5c1](https://github.com/HansKristoffer/tokenmaxxing/commit/a50d5c16871d1f066b42f6d91a68a1730e001518))
* **desktop:** a Tauri app that is the menu bar app and the game window ([c42964c](https://github.com/HansKristoffer/tokenmaxxing/commit/c42964cf2392007c273c7d57b65cb6af1d5e37d2))
* **desktop:** the app updates itself, and says so in the game ([d28803f](https://github.com/HansKristoffer/tokenmaxxing/commit/d28803f7b75e1b2b57bf514bf93c7f21b2ca52f9))
* Due Diligence, Liar's Dice for 2–6 players ([1d3c32a](https://github.com/HansKristoffer/tokenmaxxing/commit/1d3c32a1cb4deeaf9d955b9645e92271e9b88550))
* game stats on player cards and a Games tab on the leaderboard ([0f0bbe3](https://github.com/HansKristoffer/tokenmaxxing/commit/0f0bbe3edb18184bc37f13fcb83b55fcd4f68b71))
* **helper:** today's count and the battle standing, for the menu bar ([dcd40b1](https://github.com/HansKristoffer/tokenmaxxing/commit/dcd40b1ddea079ebfd2ee961fdcb3c1befa3a714))
* Hype Cycle, a crash game for 2–8 players ([3ceea61](https://github.com/HansKristoffer/tokenmaxxing/commit/3ceea611d516c249b6b9c69aa1942ae5f3393e1e))
* rank the leaderboard by agent hours ([7829b2a](https://github.com/HansKristoffer/tokenmaxxing/commit/7829b2a19659f8b39703d26c61791bf1e0c9c8dc))
* rebuild the backend on Rivet actors for one shared pixel world ([6755884](https://github.com/HansKristoffer/tokenmaxxing/commit/6755884f027eaf78537b21d96682eb9207a94986))
* **release:** the website's Download button fetches the installer itself ([83d4273](https://github.com/HansKristoffer/tokenmaxxing/commit/83d427322b2bed8944dc17ea513cdacd7adf89fc))
* **server:** a coin ledger for stakes, bets and payouts ([e164cd9](https://github.com/HansKristoffer/tokenmaxxing/commit/e164cd9795d15fb672f7790b280718be7926bf0a))
* **server:** tables, matches and games gathering in town ([e2aa7f2](https://github.com/HansKristoffer/tokenmaxxing/commit/e2aa7f2cdfed65d0849c8fa3ca3097b67026c269))
* ship the Tauri desktop app instead of the Swift menu bar app ([52b8de9](https://github.com/HansKristoffer/tokenmaxxing/commit/52b8de9fa042e401811e302d5d89c43f82292fe4))
* the town grows where new companies choose to build ([78412b0](https://github.com/HansKristoffer/tokenmaxxing/commit/78412b032fda120660a4b2dd5d5867be7094cd40))
* Tokenmaxxing, burn the most real tokens in the time you agreed ([2c1471b](https://github.com/HansKristoffer/tokenmaxxing/commit/2c1471b64774a9dead45682fcbff5305816200c7))
* **web:** a games box under the leaderboard ([5475574](https://github.com/HansKristoffer/tokenmaxxing/commit/5475574e697ce476e7061609c6cedc0671d2139b))
* **web:** a nicer leaderboard with a podium ([e84b1ab](https://github.com/HansKristoffer/tokenmaxxing/commit/e84b1ab10b4874197aac63feb93edfcf8ec34b56))
* **web:** quick replies above the chat, and emoji bursts ([b02d7a8](https://github.com/HansKristoffer/tokenmaxxing/commit/b02d7a8b68e6b20d94c202f6f8dc318a7dd678b2))
* **web:** the arcade, the match panel, and games at tables in town ([61cfc36](https://github.com/HansKristoffer/tokenmaxxing/commit/61cfc36947e8885eb3462ff695270a56afde7242))
* **web:** the world client: town, houses, chat, leaderboard and shop ([c9ebaae](https://github.com/HansKristoffer/tokenmaxxing/commit/c9ebaaee9869acd78f01895b47bfa8f9b1e64e44))
* **web:** tidier HUD, smooth zoom, and @-invites like chat mentions ([6948e30](https://github.com/HansKristoffer/tokenmaxxing/commit/6948e3034f9a9e18a133cfc67fc18da113910529))
* **web:** who's online in the room, from the chat header ([4786a91](https://github.com/HansKristoffer/tokenmaxxing/commit/4786a9134abb877d6b768daf33271fb8ac907df1))


### Bug Fixes

* release blockers from the cleanup plan ([d7acdbe](https://github.com/HansKristoffer/tokenmaxxing/commit/d7acdbe81e07224178d85f927d89e201593d3b29))
* **server:** a dropped websocket can't take the server down ([57cec46](https://github.com/HansKristoffer/tokenmaxxing/commit/57cec46fa7429dabac99f5791e244cfb8d87c182))
* **web:** clicking the minimap walks to the tile you clicked ([f775e49](https://github.com/HansKristoffer/tokenmaxxing/commit/f775e49b27511a4ca770612b6e4739f1c54aeab3))


### Performance Improvements

* **web:** less work per frame in the world ([266ba59](https://github.com/HansKristoffer/tokenmaxxing/commit/266ba59e4f973a5cb9dd1d2a919cb357e593319f))

## [0.5.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.4.0...v0.5.0) (2026-09-29)


### Features

* **chat:** improve chat layout and reactions ([bc5ab1b](https://github.com/HansKristoffer/tokenmaxxing/commit/bc5ab1b992ac982d7846efcc2d3507b092092c74))
* **chat:** improve timeline message interactions ([8c24c73](https://github.com/HansKristoffer/tokenmaxxing/commit/8c24c73b0c14bb677c60dfb96ea20d6a0b18bac1))

## [0.4.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.3.0...v0.4.0) (2026-09-28)


### Features

* **chat:** add daily leaderboard races and group timelines ([da1dfc5](https://github.com/HansKristoffer/tokenmaxxing/commit/da1dfc5649b4409423047ec12a94b21d3baf5b86))
* **chat:** add daily leaderboard races and group timelines ([bede680](https://github.com/HansKristoffer/tokenmaxxing/commit/bede6800478c5ada094b861c6c3ec4a3adda4978))
* **github:** track pull requests on leaderboards ([e962e6c](https://github.com/HansKristoffer/tokenmaxxing/commit/e962e6cbbe0d184f470b2cfe2de85ee1e4175969))
* **github:** track pull requests on leaderboards ([55a60ed](https://github.com/HansKristoffer/tokenmaxxing/commit/55a60edb464e19d73ca1fae4dced62a656e80f8d))

## [0.3.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.2.1...v0.3.0) (2026-09-23)


### Features

* **bar:** resize settings window and link to GitHub ([613af87](https://github.com/HansKristoffer/tokenmaxxing/commit/613af879b1506fdb662a5947dd57ef530b7d682c))
* **bar:** resize settings window and link to GitHub ([918aa28](https://github.com/HansKristoffer/tokenmaxxing/commit/918aa2835496223ba11db88c72611b9e87ae2c38))
* **cli:** let users rename accounts and groups ([882a6be](https://github.com/HansKristoffer/tokenmaxxing/commit/882a6be11daeb7a456f7ab95d53542f5847e3280))
* **cli:** let users rename accounts and groups ([746132e](https://github.com/HansKristoffer/tokenmaxxing/commit/746132ed5c42477d0e2c0756a758efb47ba251c6))
* **web:** let a group owner remove members from the dashboard ([#4](https://github.com/HansKristoffer/tokenmaxxing/issues/4)) ([3076f04](https://github.com/HansKristoffer/tokenmaxxing/commit/3076f04b49c3c73baab3696cf102d731360408b4))

## [0.2.1](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.2.0...v0.2.1) (2026-09-23)


### Bug Fixes

* relaunch the updated app by path and isolate dev builds ([1a2a900](https://github.com/HansKristoffer/tokenmaxxing/commit/1a2a9005276f08a785d38bc4643906e6cecb10e8))

## [0.2.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.1.0...v0.2.0) (2026-09-23)


### Features

* show available updates and upgrade in place ([82ef972](https://github.com/HansKristoffer/tokenmaxxing/commit/82ef972c86a7122e6cd5efddfe00e3871e45e13d))


### Bug Fixes

* resize the menu bar popover when its content changes ([5ce59e6](https://github.com/HansKristoffer/tokenmaxxing/commit/5ce59e6bb9adcf498ab9a0f3556cef1a47c32901))

## [0.1.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v0.1.0...v0.1.0) (2026-09-23)


### Features

* app icon and first release ([a1f6b2e](https://github.com/HansKristoffer/tokenmaxxing/commit/a1f6b2e7f13f8be945dcad9dd34a139e24ae7d2b))
