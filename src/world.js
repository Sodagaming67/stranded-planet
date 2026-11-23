import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const RADIUS = 80;
export const SHIP_DIR = new THREE.Vector3(0, 1, 0);
export const colliders = [];

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(1, 0, 0);
const toAngle = (distance) => distance / RADIUS;

function addCollider(pos, r, top, land = r + 0.2) {
  colliders.push({ pos, r, top: pos.length() + top, land });
}

function makeRandom(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function randomDir(rand) {
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

function towards(from, to) {
  return to.clone().addScaledVector(from, -to.dot(from)).normalize();
}

function offsetDir(center, distance, around) {
  const angle = toAngle(distance);
  const [t1, t2] = tangentBasis(center);
  return center.clone().multiplyScalar(Math.cos(angle))
    .addScaledVector(t1, Math.cos(around) * Math.sin(angle))
    .addScaledVector(t2, Math.sin(around) * Math.sin(angle))
    .normalize();
}

function away(dir, center, innerDistance, outerDistance) {
  return THREE.MathUtils.smoothstep(dir.angleTo(center), toAngle(innerDistance), toAngle(outerDistance));
}

const waveRand = makeRandom(1234);
const waves = Array.from({ length: 18 }, (_, i) => ({
  d: randomDir(waveRand),
  k: 4 + waveRand() * (8 + i * 2),
  a: 1.6 / (1 + i * 0.5),
  ph: waveRand() * Math.PI * 2,
}));

export function heightAt(dir) {
  let h = 0;
  for (const w of waves) h += w.a * Math.sin(w.k * dir.dot(w.d) + w.ph);
  return h * away(dir, SHIP_DIR, 4, 12);
}

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

function placeOn(obj, dir, facing, sink = 0) {
  const up = dir.clone().normalize();
  _z.copy(facing).addScaledVector(up, -facing.dot(up)).normalize();
  _x.crossVectors(up, _z);
  _m.makeBasis(_x, up, _z);
  obj.quaternion.setFromRotationMatrix(_m);
  obj.position.copy(up).multiplyScalar(RADIUS + heightAt(up) - sink);
  return obj;
}

function createPlanet() {
  const geo = new THREE.IcosahedronGeometry(RADIUS, 80);
  const pos = geo.attributes.position;
  const heights = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    heights[i] = heightAt(v);
    v.multiplyScalar(RADIUS + heights[i]);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  const low = new THREE.Color('#2f8f87');
  const high = new THREE.Color('#7cc576');
  const scorch = new THREE.Color('#3d3230');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const rand = makeRandom(42);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    d.fromBufferAttribute(pos, i + 2);
    const center = a.add(b).add(d).normalize();
    const h = (heights[i] + heights[i + 1] + heights[i + 2]) / 3;
    c.copy(low).lerp(high, THREE.MathUtils.clamp((h + 2) / 5, 0, 1));
    c.lerp(scorch, 0.85 * (1 - away(center, SHIP_DIR, 1.6, 4.8)));
    c.offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.05);
    for (let j = 0; j < 3; j++) c.toArray(colors, (i + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const planet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  planet.receiveShadow = true;
  return planet;
}

const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6);
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
const trunkMat = mat('#6b4f7a');
const leafMats = ['#c77dff', '#ff8fab', '#7bdff2', '#ffd166'].map((c) => mat(c));

function makeTree(rand) {
  const g = new THREE.Group();
  const leaf = leafMats[Math.floor(rand() * leafMats.length)];
  const top = mesh(puffGeo, leaf, 0, 2.9, 0);
  top.scale.setScalar(1.3);
  const side = mesh(puffGeo, leaf, 0.6, 2.3, 0.2);
  side.scale.setScalar(0.7);
  g.add(mesh(trunkGeo, trunkMat, 0, 1.2, 0), top, side);
  const s = 0.8 + rand() * 0.6;
  g.scale.setScalar(s);
  return { obj: g, r: 0.45 * s, top: 4 * s, land: 1.1 * s };
}

const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
const rockMat = mat('#7d7590');

function makeRock(rand) {
  const sx = 0.7 + rand() * 0.8;
  const rock = mesh(rockGeo, rockMat, 0, 0.2, 0);
  const sy = 0.5 + rand() * 0.5;
  rock.scale.set(sx, sy, 0.7 + rand() * 0.8);
  rock.rotation.y = rand() * Math.PI;
  const g = new THREE.Group().add(rock);
  return { obj: g, r: 0.75 * sx, top: 0.05 + 0.8 * sy };
}

const crystalGeo = new THREE.OctahedronGeometry(0.35, 0);
export const crystalMat = mat('#5ef2ff', { emissive: '#1fb8ff', emissiveIntensity: 0.6, roughness: 0.3 });

function makeCrystals(rand) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const c = mesh(crystalGeo, crystalMat, (rand() - 0.5) * 0.8, 0.3, (rand() - 0.5) * 0.8);
    c.scale.set(1, 2 + rand() * 1.5, 1);
    c.rotation.set((rand() - 0.5) * 0.6, rand() * 3, (rand() - 0.5) * 0.6);
    g.add(c);
  }
  return { obj: g, r: 0.6, top: 1.1 };
}

function makeShip() {
  const g = new THREE.Group();
  const hull = mat('#d9dde6');
  const dark = mat('#4b5263');
  const orange = mat('#ff7b29');
  const glow = mat('#ff9f43', { emissive: '#ff6b00', emissiveIntensity: 1.2 });
  const glass = mat('#6fd3ff', { roughness: 0.15, metalness: 0.3 });
  g.add(
    mesh(box(2.6, 1.4, 6), hull, 0, 0.7, 0),
    mesh(box(1.8, 1.0, 1.2), hull, 0, 0.6, 3.5),
    mesh(box(2.65, 0.25, 4), orange, 0, 0.95, 0.2),
    mesh(box(2, 0.9, 1.8), glass, 0, 1.6, 1.6),
    mesh(box(3, 0.25, 2.2), hull, -2.7, 0.5, -0.6),
    mesh(box(0.25, 1.4, 1.4), hull, 0, 1.9, -2.3),
    mesh(box(0.8, 0.8, 0.8), dark, -0.7, 0.8, -3.3),
    mesh(box(0.8, 0.8, 0.8), dark, 0.7, 0.8, -3.3),
    mesh(box(0.6, 0.6, 0.1), glow, -0.7, 0.8, -3.75),
  );

  const smokeGeo = box(0.5, 0.5, 0.5);
  const puffs = Array.from({ length: 12 }, () => {
    const p = new THREE.Mesh(smokeGeo, new THREE.MeshStandardMaterial({ color: '#555b66', transparent: true, depthWrite: false }));
    g.add(p);
    return p;
  });

  function update(t) {
    puffs.forEach((p, i) => {
      const life = (t * 0.35 + i / puffs.length) % 1;
      p.position.set(0.7 + Math.sin(i * 7 + t) * 0.3 + life * 0.8, 1 + life * 6, -3.5 - life * 0.5);
      p.scale.setScalar(0.4 + life * 2);
      p.rotation.set(i, life * 3, i * 2);
      p.material.opacity = 0.75 * (1 - life);
    });
  }
  return { obj: g, update };
}

function createSky(scene) {
  const starPos = new Float32Array(2000 * 3);
  const rand = makeRandom(7);
  for (let i = 0; i < 2000; i++) {
    randomDir(rand).multiplyScalar(600 + rand() * 300).toArray(starPos, i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false })));

  const giant = new THREE.Group();
  giant.add(new THREE.Mesh(new THREE.IcosahedronGeometry(40, 2), new THREE.MeshBasicMaterial({ color: '#e07a5f' })));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(54, 78, 48),
    new THREE.MeshBasicMaterial({ color: '#f2cc8f', side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
  );
  ring.rotation.x = 1.2;
  giant.add(ring);
  giant.position.set(-300, 190, -350);
  scene.add(giant);

  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 1), new THREE.MeshBasicMaterial({ color: '#cdd3e0' }));
  moon.position.set(350, -120, 240);
  scene.add(moon);
}

function scatterDecorations(things, rand) {
  const placed = [];
  const buckets = new Map();
  const minGap = toAngle(2.8);
  const shipClear = toAngle(16);

  function scatter(count, make, sink) {
    for (let n = 0, tries = 0; n < count && tries < count * 40; tries++) {
      const dir = randomDir(rand);
      if (dir.angleTo(SHIP_DIR) < shipClear) continue;
      if (placed.some((p) => p.angleTo(dir) < minGap)) continue;
      const { obj, r, top, land } = make(rand);
      const [a, b] = tangentBasis(dir);
      const spin = rand() * Math.PI * 2;
      placeOn(obj, dir, a.multiplyScalar(Math.cos(spin)).addScaledVector(b, Math.sin(spin)), sink);
      obj.updateMatrixWorld(true);
      obj.traverse((m) => {
        if (!m.isMesh) return;
        if (!buckets.has(m.material)) buckets.set(m.material, []);
        buckets.get(m.material).push(m.geometry.clone().applyMatrix4(m.matrixWorld));
      });
      placed.push(dir);
      addCollider(obj.position.clone(), r, top, land);
      n++;
    }
  }
  scatter(280, makeTree, 0.1);
  scatter(180, makeRock, 0.15);
  scatter(70, makeCrystals, 0.1);

  for (const [material, geos] of buckets) {
    const merged = new THREE.Mesh(mergeGeometries(geos), material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    things.add(merged);
    geos.forEach((g) => g.dispose());
  }
}

export function createWorld(scene) {
  createSky(scene);
  scene.add(createPlanet());

  const things = new THREE.Group();
  scene.add(things);

  const [shipForward, shipSide] = tangentBasis(SHIP_DIR);
  const ship = makeShip();
  placeOn(ship.obj, SHIP_DIR, shipForward, 0.4);
  ship.obj.rotateZ(0.2);
  ship.obj.rotateX(0.15);
  things.add(ship.obj);
  ship.obj.updateMatrixWorld();
  for (const z of [-2.2, 0, 2.2]) {
    addCollider(ship.obj.localToWorld(new THREE.Vector3(0, 0, z)), 1.5, 1.5);
  }

  const wingDir = offsetDir(SHIP_DIR, 4.8, 2.2);
  const wing = new THREE.Group().add(mesh(box(3, 0.25, 2.2), mat('#d9dde6')));
  placeOn(wing, wingDir, towards(wingDir, SHIP_DIR), 0.1);
  wing.rotateZ(0.35);
  things.add(wing);
  addCollider(wing.position.clone(), 1.3, 0.5);

  scatterDecorations(things, makeRandom(2024));

  const spawnAway = shipForward.clone().multiplyScalar(-0.5).addScaledVector(shipSide, 0.87);
  const spawnAngle = toAngle(8);
  const spawnDir = SHIP_DIR.clone().multiplyScalar(Math.cos(spawnAngle)).addScaledVector(spawnAway, Math.sin(spawnAngle)).normalize();

  return {
    spawnDir,
    spawnFacing: towards(spawnDir, SHIP_DIR),
    update(t) {
      ship.update(t);
      crystalMat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.25;
    },
  };
}
