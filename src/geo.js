import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const RADIUS = 60;
export const SHIP_DIR = new THREE.Vector3(0, 1, 0);
export const colliders = [];

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(1, 0, 0);

export const toAngle = (distance) => distance / RADIUS;

export function makeRandom(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function randomDir(rand) {
  const z = rand() * 2 - 1;
  const t = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(t), s * Math.sin(t), z);
}

export function tangentBasis(dir) {
  const helper = Math.abs(dir.y) < 0.9 ? UP : SIDE;
  const t1 = new THREE.Vector3().crossVectors(helper, dir).normalize();
  const t2 = new THREE.Vector3().crossVectors(dir, t1);
  return [t1, t2];
}

export function towards(from, to) {
  return to.clone().addScaledVector(from, -to.dot(from)).normalize();
}

// Round obstacle: a solid column from deep underground up to `top` above its base.
export function addCollider(pos, r, top, land = r + 0.2) {
  colliders.push({ box: false, pos, dir: pos.clone().normalize(), r, land, bottom: -Infinity, top: pos.length() + top });
}

// Rectangular obstacle between two heights (absolute distances from the planet center).
// ax/az are its sideways/forward directions; hx/hz are half its width/depth.
export function addBox(pos, ax, az, hx, hz, bottom, top) {
  const collider = { box: true, pos, dir: pos.clone().normalize(), ax, az, hx, hz, bottom, top, off: false };
  colliders.push(collider);
  return collider;
}

const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

export function placeAt(obj, dir, facing, radius) {
  const up = dir.clone().normalize();
  _z.copy(facing).addScaledVector(up, -facing.dot(up)).normalize();
  _x.crossVectors(up, _z);
  _m.makeBasis(_x, up, _z);
  obj.quaternion.setFromRotationMatrix(_m);
  obj.position.copy(up).multiplyScalar(radius);
  obj.updateMatrixWorld(true);
  return obj;
}

export const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

const GRASS_LOW = new THREE.Color('#2f8f87');
const GRASS_HIGH = new THREE.Color('#7cc576');
export function grassColor(h, out) {
  return out.copy(GRASS_LOW).lerp(GRASS_HIGH, THREE.MathUtils.clamp((h + 2) / 5, 0, 1));
}

const _up = new THREE.Vector3();
const _off = new THREE.Vector3();

// Bends a point of a flat object (built on the flat ground at `origin`) so it follows the planet's curve.
export function warpPoint(p, origin) {
  const r0 = origin.length();
  _up.copy(origin).divideScalar(r0);
  _off.subVectors(p, origin);
  const y = _off.dot(_up);
  _off.addScaledVector(_up, -y);
  const d = _off.length();
  if (d < 1e-9) return p.copy(_up).multiplyScalar(r0 + y);
  const a = d / r0;
  return p.copy(_up).multiplyScalar(Math.cos(a)).addScaledVector(_off, Math.sin(a) / d).multiplyScalar(r0 + y);
}

// Splits big triangles into small ones (so they can bend), then bends them onto the planet.
function curveGeometry(geo, origin, maxEdge = 2) {
  const up = origin.clone().normalize();
  const P = geo.attributes.position.array;
  const N = geo.attributes.normal.array;
  const U = geo.attributes.uv.array;
  const vert = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U[i * 2], U[i * 2 + 1]];
  const flatLength = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const v = dx * up.x + dy * up.y + dz * up.z;
    return Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - v * v));
  };
  const mid = (a, b) => a.map((x, k) => (x + b[k]) / 2);
  const stack = [];
  for (let i = 0; i < geo.attributes.position.count; i += 3) stack.push([vert(i), vert(i + 1), vert(i + 2)]);
  const out = [];
  while (stack.length) {
    const [a, b, c] = stack.pop();
    const ab = flatLength(a, b);
    const bc = flatLength(b, c);
    const ca = flatLength(c, a);
    const longest = Math.max(ab, bc, ca);
    if (longest <= maxEdge) out.push(a, b, c);
    else if (longest === ab) { const m = mid(a, b); stack.push([a, m, c], [m, b, c]); }
    else if (longest === bc) { const m = mid(b, c); stack.push([a, b, m], [a, m, c]); }
    else { const m = mid(c, a); stack.push([a, b, m], [m, b, c]); }
  }
  const positions = new Float32Array(out.length * 3);
  const normals = new Float32Array(out.length * 3);
  const uvs = new Float32Array(out.length * 2);
  const p = new THREE.Vector3();
  out.forEach((v, i) => {
    warpPoint(p.set(v[0], v[1], v[2]), origin).toArray(positions, i * 3);
    normals.set(v.slice(3, 6), i * 3);
    uvs.set(v.slice(6, 8), i * 2);
  });
  const curved = new THREE.BufferGeometry();
  curved.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  curved.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  curved.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return curved;
}

// Joins many static objects into one mesh per material so the game draws them all at once.
export class Batcher {
  constructor() {
    this.buckets = new Map();
  }

  add(obj, curved = false) {
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (!m.isMesh) return;
      let geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (geo.index) geo = geo.toNonIndexed();
      if (curved) geo = curveGeometry(geo, obj.position);
      if (!this.buckets.has(m.material)) this.buckets.set(m.material, []);
      this.buckets.get(m.material).push(geo);
    });
  }

  build(parent) {
    for (const [material, geos] of this.buckets) {
      const merged = new THREE.Mesh(mergeGeometries(geos), material);
      merged.castShadow = true;
      merged.receiveShadow = true;
      parent.add(merged);
      geos.forEach((g) => g.dispose());
    }
    this.buckets.clear();
  }
}
