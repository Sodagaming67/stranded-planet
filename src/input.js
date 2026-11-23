const keys = new Set();
let dx = 0;
let dy = 0;
let wheel = 0;

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement) return;
  dx += e.movementX;
  dy += e.movementY;
});
addEventListener('wheel', (e) => { wheel += e.deltaY; }, { passive: true });

const held = (...codes) => (codes.some((c) => keys.has(c)) ? 1 : 0);

export function readInput() {
  const input = {
    forward: held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown'),
    right: held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft'),
    jump: held('Space') === 1,
    run: held('ShiftLeft', 'ShiftRight') === 1,
    dx, dy, wheel,
  };
  dx = dy = wheel = 0;
  return input;
}
