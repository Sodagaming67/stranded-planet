import * as THREE from 'three';
import { RADIUS, SHIP_DIR, colliders, towards, placeAt, addCollider } from './geo.js';
import { heightAt } from './world.js';
import { TOWN_DIR } from './town.js';
import { ammo, inventory, announce } from './economy.js';
import { npcs } from './npcs.js';

// Old-time guns: equip one from the bag, then click to fire. Each shot uses one lead ball.
// Lead balls fly, drop a little, and stop when they hit the ground, a wall, or a target.
// They never hurt the aliens: aliens duck and tell you off instead.

export const GUNS = {
  'Flintlock pistol': { reload: 1.2, speed: 70, pellets: 1, spread: 0.012, model: 'pistol', loud: 0.6 },
  Blunderbuss: { reload: 2, speed: 55, pellets: 6, spread: 0.07, model: 'blunderbuss', loud: 1 },
  'Long musket': { reload: 2.6, speed: 110, pellets: 1, spread: 0.003, model: 'musket', loud: 0.9 },
};

export const arsenal = { equipped: null, reloadLeft: 0, hits: 0 };

const GRAVITY = 15;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });
const M = {
  wood: mat('#7a4e2d'),
  iron: mat('#3b3b3b', { metalness: 0.5 }),
  brass: mat('#c9a227', { metalness: 0.6, roughness: 0.35 }),
  ball: mat('#2a2a2a', { metalness: 0.6 }),
  flash: new THREE.MeshBasicMaterial({ color: '#ffcf6b' }),
  red: mat('#c0392b'),
  white: mat('#f4f1e8'),
  post: mat('#5e4128'),
};

let scene = null;
let player = null;
let gunModel = null;
let muzzle = null;
const balls = [];
const puffs = [];
const targets = [];

// ---------- Gun models (built pointing along +z from the hand) ----------

function piece(geo, material, x, y, z, alongZ = false) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (alongZ) m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}

function buildGun(kind) {
  const g = new THREE.Group();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const tube = (r, len, r2 = r) => new THREE.CylinderGeometry(r2, r, len, 8);
  let end = 0.4;
  if (kind === 'pistol') {
    g.add(
      piece(box(0.07, 0.18, 0.1), M.wood, 0, -0.08, -0.02),
      piece(box(0.08, 0.09, 0.2), M.wood, 0, 0.02, 0.05),
      piece(tube(0.03, 0.38), M.iron, 0, 0.04, 0.3, true),
      piece(box(0.03, 0.08, 0.04), M.brass, 0, 0.09, 0.02),
    );
    end = 0.5;
  } else if (kind === 'musket') {
    g.add(
      piece(box(0.08, 0.13, 0.55), M.wood, 0, -0.02, -0.15),
      piece(tube(0.028, 1.05), M.iron, 0, 0.05, 0.45, true),
      piece(tube(0.035, 0.05), M.brass, 0, 0.05, 0.2, true),
      piece(tube(0.035, 0.05), M.brass, 0, 0.05, 0.65, true),
    );
    end = 0.98;
  } else {
    g.add(
      piece(box(0.08, 0.13, 0.42), M.wood, 0, -0.02, -0.1),
      piece(tube(0.035, 0.6), M.brass, 0, 0.05, 0.35, true),
      piece(new THREE.CylinderGeometry(0.1, 0.035, 0.16, 10), M.brass, 0, 0.05, 0.72, true),
    );
    end = 0.8;
  }
  const tip = new THREE.Object3D();
  tip.position.set(0, 0.05, end);
  g.add(tip);
  return { group: g, tip };
}

// ---------- Equipping ----------

export function equip(name) {
  if (!GUNS[name] || !inventory.some((i) => i.name === name)) return `You don't have a ${name.toLowerCase()}.`;
  holster();
  const built = buildGun(GUNS[name].model);
  gunModel = built.group;
  muzzle = built.tip;
  gunModel.rotation.x = Math.PI / 2;
  gunModel.position.set(0, -0.74, 0.04);
  player.hand.add(gunModel);
  player.aiming = true;
  arsenal.equipped = name;
  arsenal.reloadLeft = 0;
  return `You're holding the ${name.toLowerCase()}. Click to fire. Lead balls: ${ammo.balls}.`;
}

export function holster() {
  if (gunModel) player.hand.remove(gunModel);
  gunModel = null;
  muzzle = null;
  player.aiming = false;
  const name = arsenal.equipped;
  arsenal.equipped = null;
  return name ? `You put away the ${name.toLowerCase()}.` : '';
}

// ---------- Sounds (made on the fly, no sound files needed) ----------

let audio = null;
function sound(kind, loud = 1) {
  try {
    audio ??= new AudioContext();
  } catch {
    return;
  }
  const now = audio.currentTime;
  const gain = audio.createGain();
  gain.connect(audio.destination);
  if (kind === 'bang') {
    const length = Math.floor(audio.sampleRate * 0.6);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + 600 * (1 - loud);
    gain.gain.value = 0.6 * loud;
    source.connect(filter).connect(gain);
    source.start(now);
    return;
  }
  const tone = audio.createOscillator();
  tone.type = kind === 'ding' ? 'triangle' : 'square';
  tone.frequency.value = kind === 'ding' ? 1100 : 220;
  gain.gain.setValueAtTime(kind === 'ding' ? 0.25 : 0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'ding' ? 0.5 : 0.06));
  tone.connect(gain);
  tone.start(now);
  tone.stop(now + 0.6);
}

// ---------- Firing ----------

const _aim = new THREE.Vector3();
const _from = new THREE.Vector3();
const _step = new THREE.Vector3();

// The spot under the crosshair (so the ball flies exactly where you aim, even though the gun is off to the side).
// Walks along the camera's line of sight using the game's own collision checks, which is much faster than a raycast.
function crosshairSpot(camera) {
  camera.getWorldDirection(_aim);
  _step.copy(camera.position).addScaledVector(_aim, 2);
  for (let d = 2; d < 150; d += 0.5) {
    _step.addScaledVector(_aim, 0.5);
    if (hitsSomething(_step) || nearTarget(_step) || nearAlien(_step)) return _step.clone();
  }
  return _step.clone();
}

export function fire(camera) {
  const name = arsenal.equipped;
  if (!name) return;
  const gun = GUNS[name];
  if (arsenal.reloadLeft > 0) return;
  if (ammo.balls <= 0) {
    sound('click');
    announce('Click! No lead balls left. Buy more at the gun shop.');
    return;
  }
  ammo.balls--;
  arsenal.reloadLeft = gun.reload;
  muzzle.getWorldPosition(_from);
  const direction = crosshairSpot(camera).sub(_from).normalize();
  // Old guns shoot a bit high so the ball's drop lands on the crosshair at normal distances.
  direction.addScaledVector(_from.clone().normalize(), 0.006).normalize();
  for (let i = 0; i < gun.pellets; i++) {
    const dir = direction.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(gun.spread * 2)).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), M.ball);
    mesh.position.copy(_from);
    scene.add(mesh);
    balls.push({ mesh, velocity: dir.multiplyScalar(gun.speed), life: 3 });
  }
  addPuff(_from, M.flash, 0.06, 0.35, 0.05);
  for (let i = 0; i < 4; i++) addPuff(_from.clone().addScaledVector(direction, i * 0.15), smoke(0.7), 0.9 + i * 0.2, 0.15, 0.8 + i * 0.3);
  sound('bang', gun.loud);
}

function smoke(opacity) {
  return new THREE.MeshStandardMaterial({ color: '#d9d4cc', transparent: true, opacity, depthWrite: false });
}

function addPuff(position, material, life, size, grow) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
  mesh.position.copy(position);
  mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  scene.add(mesh);
  puffs.push({ mesh, life, maxLife: life, grow, startOpacity: material.opacity ?? 1 });
}

// ---------- What a lead ball can hit ----------

const _up = new THREE.Vector3();
const _off = new THREE.Vector3();
const _hitTarget = new THREE.Vector3();

function hitsSomething(pos) {
  _up.copy(pos).normalize();
  const r = pos.length();
  if (r < RADIUS + heightAt(_up)) return 'ground';
  const near = Math.cos(4 / RADIUS);
  for (const c of colliders) {
    if (c.off || c.dir.dot(_up) < near || r > c.top || r < c.bottom) continue;
    _off.subVectors(pos, c.pos);
    _off.addScaledVector(_up, -_off.dot(_up));
    if (c.box ? Math.abs(_off.dot(c.ax)) < c.hx && Math.abs(_off.dot(c.az)) < c.hz : _off.length() < c.r) return 'wall';
  }
  return null;
}

function nearTarget(pos) {
  return targets.some((target) => target.down <= 0 && target.board.getWorldPosition(_hitTarget).distanceTo(pos) < 0.65);
}

function nearAlien(pos) {
  return npcs.some((npc) => npc.group.visible && _hitTarget.copy(npc.group.position).addScaledVector(npc.pos, 1.2).distanceTo(pos) < 1);
}

function checkTargets(pos) {
  for (const target of targets) {
    if (target.down > 0) continue;
    target.board.getWorldPosition(_hitTarget);
    const d = _hitTarget.distanceTo(pos);
    if (d < 0.65) {
      target.down = 4;
      arsenal.hits++;
      sound('ding');
      announce(d < 0.2 ? `Bullseye! Targets hit: ${arsenal.hits}` : `Hit! Targets hit: ${arsenal.hits}`);
      return true;
    }
  }
  return false;
}

const scolded = new Map();
function checkAliens(pos) {
  for (const npc of npcs) {
    if (!npc.group.visible) continue;
    _hitTarget.copy(npc.group.position).addScaledVector(npc.pos, 1.2);
    if (_hitTarget.distanceTo(pos) > 1) continue;
    if ((scolded.get(npc) ?? 0) < performance.now()) {
      scolded.set(npc, performance.now() + 5000);
      const lines = ["Hey! Don't point that at me!", 'Whoa! Watch where you aim that thing!', "Ahh! That's not funny!", 'Careful! Shoot at the targets, not at people!'];
      announce(`${npc.name} ducks just in time! "${lines[Math.floor(Math.random() * lines.length)]}"`);
    }
    return true;
  }
  return false;
}

// ---------- Shooting range near the ship ----------

function buildRange() {
  const toTown = towards(SHIP_DIR, TOWN_DIR);
  const away = toTown.clone().negate();
  for (const angle of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const t = away.clone().applyAxisAngle(SHIP_DIR, angle);
    const dir = SHIP_DIR.clone().applyAxisAngle(new THREE.Vector3().crossVectors(SHIP_DIR, t).normalize(), 15 / RADIUS);
    const group = new THREE.Group();
    group.add(piece(new THREE.BoxGeometry(0.15, 1.3, 0.15), M.post, 0, 0.65, 0));
    const board = new THREE.Group();
    board.position.y = 1.25;
    const ring = (r, material, z) => {
      const disc = piece(new THREE.CylinderGeometry(r, r, 0.06, 20), material, 0, 0.55, z, true);
      board.add(disc);
    };
    ring(0.6, M.white, 0);
    ring(0.45, M.red, 0.01);
    ring(0.3, M.white, 0.02);
    ring(0.15, M.red, 0.03);
    group.add(board);
    placeAt(group, dir, towards(dir, SHIP_DIR), RADIUS + heightAt(dir));
    scene.add(group);
    addCollider(group.position.clone(), 0.12, 1.3);
    targets.push({ group, board: board.children[0], pivot: board, down: 0 });
  }
}

export function initGuns(sceneRef, playerRef) {
  scene = sceneRef;
  player = playerRef;
  buildRange();
}

// ---------- Every frame ----------

export function updateGuns(dt) {
  arsenal.reloadLeft = Math.max(0, arsenal.reloadLeft - dt);

  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    ball.life -= dt;
    const steps = Math.max(1, Math.ceil((ball.velocity.length() * dt) / 0.25));
    let stopped = ball.life <= 0;
    for (let s = 0; s < steps && !stopped; s++) {
      const h = dt / steps;
      _up.copy(ball.mesh.position).normalize();
      ball.velocity.addScaledVector(_up, -GRAVITY * h);
      ball.mesh.position.addScaledVector(ball.velocity, h);
      if (checkTargets(ball.mesh.position) || checkAliens(ball.mesh.position)) stopped = true;
      else if (hitsSomething(ball.mesh.position)) {
        addPuff(ball.mesh.position, smoke(0.8), 0.6, 0.12, 0.6);
        stopped = true;
      }
    }
    if (stopped) {
      scene.remove(ball.mesh);
      ball.mesh.geometry.dispose();
      balls.splice(i, 1);
    }
  }

  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.life -= dt;
    const t = 1 - p.life / p.maxLife;
    p.mesh.scale.setScalar(1 + t * p.grow * 4);
    p.mesh.position.addScaledVector(p.mesh.position.clone().normalize(), dt * 0.6);
    if (p.mesh.material.transparent) p.mesh.material.opacity = p.startOpacity * (1 - t);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      puffs.splice(i, 1);
    }
  }

  for (const target of targets) {
    if (target.down > 0) {
      target.down -= dt;
      target.pivot.rotation.x += (-Math.PI / 2 - target.pivot.rotation.x) * Math.min(1, dt * 10);
    } else {
      target.pivot.rotation.x += (0 - target.pivot.rotation.x) * Math.min(1, dt * 4);
    }
  }
}
