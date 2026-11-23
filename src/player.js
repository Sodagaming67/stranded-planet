import * as THREE from 'three';
import { RADIUS, heightAt, colliders } from './world.js';

const SUIT = '#f1f1f1';
const ACCENT = '#ff7b29';
const WALK_SPEED = 6;
const RUN_SPEED = 11;
const JUMP_SPEED = 9;
const GRAVITY = 25;

function part(w, h, d, color, x, y, z, extra = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function limb(w, h, d, x, y, z, endColor) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.add(part(w, h, d, SUIT, 0, -h / 2, 0));
  pivot.add(part(w + 0.04, 0.18, d + 0.04, endColor, 0, -h + 0.09, 0));
  return pivot;
}

function buildAstronaut() {
  const g = new THREE.Group();
  const legL = limb(0.32, 0.8, 0.34, -0.19, 0.8, 0, '#3d405b');
  const legR = limb(0.32, 0.8, 0.34, 0.19, 0.8, 0, '#3d405b');
  const armL = limb(0.24, 0.72, 0.26, -0.53, 1.6, 0, ACCENT);
  const armR = limb(0.24, 0.72, 0.26, 0.53, 1.6, 0, ACCENT);
  g.add(
    legL, legR, armL, armR,
    part(0.8, 0.85, 0.46, SUIT, 0, 1.22, 0),
    part(0.82, 0.14, 0.48, ACCENT, 0, 0.88, 0),
    part(0.6, 0.7, 0.3, '#b8c0cc', 0, 1.27, -0.38),
    part(0.16, 0.16, 0.06, '#59f28a', 0.15, 1.45, -0.54, { emissive: '#59f28a', emissiveIntensity: 0.8 }),
    part(0.72, 0.66, 0.66, SUIT, 0, 1.98, 0),
    part(0.54, 0.36, 0.06, '#1d2747', 0, 2.0, 0.33, { roughness: 0.15, metalness: 0.4 }),
    part(0.05, 0.4, 0.05, '#888888', 0.22, 2.5, -0.1),
    part(0.12, 0.12, 0.12, ACCENT, 0.22, 2.72, -0.1, { emissive: ACCENT, emissiveIntensity: 0.6 }),
  );
  return { model: g, legL, legR, armL, armR };
}

export function createPlayer(scene, spawnDir, facingDir) {
  const { model, legL, legR, armL, armR } = buildAstronaut();
  scene.add(model);

  const up = spawnDir.clone().normalize();
  const position = up.clone().multiplyScalar(RADIUS + heightAt(up) + 0.5);
  const velocity = new THREE.Vector3();
  const facing = facingDir.clone();
  let vUp = 0;
  let grounded = false;
  let phase = 0;

  const wish = new THREE.Vector3();
  const right = new THREE.Vector3();
  const push = new THREE.Vector3();
  const side = new THREE.Vector3();
  const target = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  function swing(limbPart, angle, dt) {
    limbPart.rotation.x += (angle - limbPart.rotation.x) * (1 - Math.exp(-15 * dt));
  }

  function update(dt, input, camForward) {
    up.copy(position).normalize();
    right.crossVectors(camForward, up);
    wish.copy(camForward).multiplyScalar(input.forward).addScaledVector(right, input.right);
    if (wish.lengthSq() > 1) wish.normalize();
    wish.multiplyScalar(input.run ? RUN_SPEED : WALK_SPEED);
    velocity.lerp(wish, 1 - Math.exp(-(grounded ? 12 : 3) * dt));

    if (input.jump && grounded) {
      vUp = JUMP_SPEED;
      grounded = false;
    }
    vUp -= GRAVITY * dt;
    position.addScaledVector(velocity, dt).addScaledVector(up, vUp * dt);

    up.copy(position).normalize();
    for (const c of colliders) {
      push.subVectors(position, c.pos);
      push.addScaledVector(up, -push.dot(up));
      const d = push.length();
      const min = c.r + 0.4;
      if (d < min && d > 1e-4) position.addScaledVector(push, (min - d) / d);
    }

    up.copy(position).normalize();
    const ground = RADIUS + heightAt(up);
    const above = position.length() - ground;
    if (above <= 0 || (grounded && vUp <= 0 && above < 0.4)) {
      position.setLength(ground);
      vUp = 0;
      grounded = true;
    } else {
      grounded = false;
    }
    velocity.addScaledVector(up, -velocity.dot(up));

    const speed = velocity.length();
    facing.addScaledVector(up, -facing.dot(up)).normalize();
    if (speed > 0.5) {
      target.copy(velocity).divideScalar(speed);
      const sign = Math.sign(push.crossVectors(facing, target).dot(up)) || 1;
      facing.applyAxisAngle(up, sign * Math.min(facing.angleTo(target), 14 * dt));
    }
    side.crossVectors(up, facing);
    basis.makeBasis(side, up, facing);
    model.quaternion.setFromRotationMatrix(basis);
    model.position.copy(position);

    if (grounded) {
      phase += dt * speed * 1.4;
      const s = Math.sin(phase) * 0.7 * Math.min(speed / WALK_SPEED, 1);
      swing(legL, s, dt);
      swing(legR, -s, dt);
      swing(armL, -s * 0.8, dt);
      swing(armR, s * 0.8, dt);
    } else {
      swing(legL, 0.5, dt);
      swing(legR, -0.3, dt);
      swing(armL, -2.6, dt);
      swing(armR, -2.6, dt);
    }
  }

  return { position, update, get grounded() { return grounded; } };
}
