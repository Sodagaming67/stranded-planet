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

## Untested by a human
- How the controls *feel* (speed, jump height, mouse sensitivity).
- Camera can go inside trees or through house walls when it is right behind one.
- How walking around inside houses feels.

## Next
- Philip will add health and oxygen himself later.
- Waiting for Philip's next ideas.
