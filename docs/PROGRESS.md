# Progress

## Done
- Project set up (Three.js + Vite).
- **Stage 1 — world + character (2026-11-23)**
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

## Untested by a human
- How the controls *feel* (speed, jump height, mouse sensitivity).
- Camera can go inside trees when it is right behind one.

## Next
- Philip will add health and oxygen himself later.
- Waiting for Philip's next ideas.
