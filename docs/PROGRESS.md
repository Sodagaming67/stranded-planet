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

## Untested by a human
- How the controls *feel* (speed, jump height, mouse sensitivity).
- Camera can go inside trees when it is right behind one.

## Next
- Stage 2: town, NPCs to talk to, shop.
