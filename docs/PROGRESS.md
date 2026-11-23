# Progress

## Done
- Project set up (Three.js + Vite).
- **Stage 1 â€” world + character (2026-11-23)**
  - Tiny round planet (radius 40) with rolling hills; gravity pulls toward the center, so you can walk all the way around.
  - Crashed ship with smoke, broken wing, scorched crater. You start next to it.
  - Dirt path from the ship to a small town: 5 colorful houses + crystal fountain (placeholder until the town vibe is decided).
  - 70 alien trees, 45 rocks, 18 glowing crystal clusters. You bump into them instead of walking through.
  - Space sky: stars, a ringed planet, a moon.
  - Blocky astronaut: walk/run animation, arms up when jumping, oxygen backpack with green light.
  - Controls: WASD move, mouse look (click to lock), Space jump, Shift run, scroll zoom, Esc pause.

- **Update (2026-11-23)**
  - Arrow keys shown on the controls screen (they already moved the player).
  - Ship glitch fixed: obstacles now have a height. You can land and stand on the ship, rocks, trees, houses, the fountain, and the broken wing, and walk up small steps (like along the tilted ship).
  - Health bar (top-left). Nothing hurts you yet.
  - Low gravity: jumps are about 4x higher (~6.5 units, ~1.6 s in the air), with more air control.

- **Update 2 (2026-11-23)**
  - Start screen is now a solid space screen (game hidden). You can't move until you click in. Esc shows the same screen as "Paused".
  - Planet doubled in size (radius 80, about 4x the ground). Town and dirt path removed (Philip's choice).
  - 280 trees, 180 rocks, 70 crystal clusters, merged into a few big shapes so it doesn't lag.
  - Test hook: open the game at `localhost:5180/#test` to skip the start screen (used for screenshots).

- **Town (2026-11-23)** — `src/town.js`
  - Huge rustic hillside town (~130 units across), ~92 units from the ship, linked by a dirt road.
  - 3 levels: lower town, raised middle level (stone cliffs + wooden fences), hilltop plaza (cobbles, stone well, 4 market stalls, big hall).
  - 7 stone staircases (4 up to the middle, 3 up to the plaza). Cliffs block walking; you can still jump up them.
  - Dirt roads: inner ring, outer ring, middle-level ring, a lane around the plaza cliff, streets out of town.
  - 67 hollow houses (empty inside): plaster + timber frame, plank, or stone walls; stone foundations, plank floors, doorways, shuttered windows, pitched roofs, some chimneys. You can walk in; roofs stop your jumps inside; you can stand on roofs.
  - Props: barrels, crates, hay bales, carts, lantern posts (flame lanterns). Nothing modern.
  - For NPCs later: `townWalkways` in `src/town.js` lists every road, staircase and the plaza (flat town map coordinates; `toDir` turns them into planet positions).
  - New collision system (`src/geo.js` + `src/player.js`): thin walls, ceilings, floors, step-up stairs, steep cliffs.
  - Test hooks: `localhost:5180/#test` (skip start screen) and `#test-town` (start at the town gate).

- **Shops + bank (2026-11-23)**
  - Shop district: about 40% of the lower town (centered on the main street from the ship) is now 24 shops and public buildings, each with a carved wooden name sign: Inn & Hotel, Hospital, General Store, Tavern, Blacksmith, Bakery, Post Office, Tailor, Library, plus extras (Grocer, Clinic, Potion Shop, Carpenter, Butcher, Toy Shop, Book Shop, Farm Supply, Boarding House).
  - Insides match the building: counters + shelves (shops), beds (hotel, hospital, clinic), bar + tables (tavern), glowing forge + anvil (blacksmith), bookshelves (library). Hotels are 2 stories with a balcony.
  - Giant stone BANK in the middle of the hilltop plaza: columns, front steps, gold sign + coin, teller counter, round vault door. Plaza made bigger; well + 2 market stalls moved behind the bank.
  - Town is a bit bigger (outer ring road moved out) so the bigger buildings fit.

- **Money + bank vaults (2026-11-23)**
  - Currency is silver and gold coins (10 silver = 1 gold), in `src/money.js` (`wallet`). You start with 0 gold, 10 silver.
  - Money counter in the top-right corner (gold coin + silver coin).
  - Bank made bigger (13 x 9) with 3 walk-in vaults of different sizes behind the teller counter (small 2.6 x 2.2, medium 3.9 x 2.9, large 5.5 x 3.6). Iron walls, open round vault doors, piles of coins: silver/gold stacks, heaps, gold bars, treasure chests, coin sacks. The coins are decoration only (can't be picked up yet).
  - Two candle chandeliers inside the bank give real light. Lanterns and props no longer block doorways.

- **Giant packed town (2026-11-23)** - replaces the earlier town
  - Every building has 10x the floor space (about 3x wider, deeper and taller). Normal houses removed for now.
  - Town moved to the far side of the planet (about 110 steps from the ship along the dirt road). Planet size unchanged.
  - Layout: a raised square plaza in the middle with the giant bank (41 x 28, 22 tall), 4 stone staircases, a street around the plaza, then rows of buildings standing wall to wall on all 4 sides, a back street behind them, and 4 cross streets (the main one leads to the ship).
  - Buildings: Inn & Hotel, Hospital, General Store, Tavern, Blacksmith, Bakery, Post Office, Tailor, Library + narrower fillers (Herbalist, Shoemaker...). Insides scaled up too (rows of beds, shelves, tables, forges, bookshelf aisles). Bank vaults are now 8 x 7, 13 x 9 and 18 x 11 with hundreds of coin stacks.
  - Buildings are gently bent to follow the planet's curve (`curveGeometry` / `warpPoint` in `src/geo.js`) so they sit flat on the ground and touch their neighbors. Every placement is checked so buildings never overlap each other or the streets.
  - `townWalkways` now also lists every building's door (`doors`: a spot outside and inside), for NPCs later.

- **Furnished insides, hotel rooms, vault doors, shops ready for workers (2026-11-23)**
  - Every building (except the bank's grand hall) has a wooden beamed ceiling at room height. Furniture kit + room layouts live in `src/interiors.js`: rugs, hanging lanterns, plants, paintings, candles, chairs, benches, fireplace, weapon rack, globe, and more.
  - Hotels / boarding house: lobby with reception desk, a hallway, and separate numbered bedrooms (bed, nightstand, wardrobe, table, chair, rug, painting). The Inn & Hotel has 10 rooms.
  - Hospital / clinic: beds with curtains, nightstands, doctor desks, medicine shelves, washbasins.
  - Every shop is stocked with its own goods (bread and pies, potions, cloth rolls, vegetables, meat, cheese, candles, pots, books, toys, shoes, tools, parcels, herbs, planks).
  - `src/services.js`: what every building offers and sells (prices in silver/gold). `buildingServices` in `src/town.js` gives each building its worker spots, customer spots, door, and hotel room spots, ready for alien workers.
  - Bank vault doors are real swinging doors, closed by default. Only aliens can open/close them: `vault.open(alien)` / `vault.close(alien)` work only if `alien.isAlien` is true. Walking up to a closed vault shows a "locked" message.
  - Test shortcut: `localhost:5180/#test-in=bakery` (any part of a building's name) starts you inside that building.

- **Ready for aliens (2026-11-23)** - see `docs/aliens-setup.md`
  - Game clock (`src/clock.js`) shown under the money: 1 real minute = 1 game hour.
  - Opening hours and alien job titles for every building; 18 jobs waiting for aliens.
  - Rules in `src/economy.js`: aliens sell items, heal, rent hotel rooms, run the bank. Hotels charge every night at 9 PM; no coins = you lose the room. Only an alien who works there can serve, only while open. Messages pop up on screen.
  - Tested with pretend aliens (scratch test): renting, nightly charges, eviction, shopping, healing, bank swap/deposit, closed shop.

## Untested by a human
- How the controls *feel* (speed, jump height, mouse sensitivity).
- Camera can go inside trees or through house walls when it is right behind one.
- How walking around inside houses feels.
- Whether the bigger town lags on Philip's computer (about 630,000 triangles in the scene now).

## Next
- Philip will add health and oxygen himself later.
- Waiting for Philip's next ideas.
