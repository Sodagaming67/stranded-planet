import * as THREE from 'three';

export const RADIUS = 40;
export const SHIP_DIR = new THREE.Vector3(0, 1, 0);
export const TOWN_DIR = new THREE.Vector3(0, Math.cos(0.9), Math.sin(0.9));
export const colliders = [];

function addCollider(pos, r, top, land = r + 0.2) {
  colliders.push({ pos, r, top: pos.length() + top, land });
}

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(1, 0, 0);

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

function offsetDir(center, angle, around) {
  const [t1, t2] = tangentBasis(center);
  return center.clone().multiplyScalar(Math.cos(angle))
    .addScaledVector(t1, Math.cos(around) * Math.sin(angle))
    .addScaledVector(t2, Math.sin(around) * Math.sin(angle))
    .normalize();
}

function away(dir, center, inner, outer) {
  return THREE.MathUtils.smoothstep(dir.angleTo(center), inner, outer);
}

const waveRand = makeRandom(1234);
const waves = Array.from({ length: 14 }, (_, i) => ({
  d: randomDir(waveRand),
  k: 2 + waveRand() * (4 + i),
  a: 1 / (1 + i * 0.5),
  ph: waveRand() * Math.PI * 2,
}));

export function heightAt(dir) {
  let h = 0;
  for (const w of waves) h += w.a * Math.sin(w.k * dir.dot(w.d) + w.ph);
  return h * Math.min(away(dir, SHIP_DIR, 0.1, 0.3), away(dir, TOWN_DIR, 0.25, 0.45));
}

const PATH_NORMAL = new THREE.Vector3().crossVectors(SHIP_DIR, TOWN_DIR).normalize();
const PATH_ANGLE = SHIP_DIR.angleTo(TOWN_DIR);

function pathDistance(dir) {
  if (dir.angleTo(SHIP_DIR) + dir.angleTo(TOWN_DIR) > PATH_ANGLE + 0.15) return Infinity;
  return Math.asin(Math.min(1, Math.abs(dir.dot(PATH_NORMAL))));
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
  const geo = new THREE.IcosahedronGeometry(RADIUS, 48);
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
  const high = new THREE.Color('#a6e08c');
  const dirt = new THREE.Color('#c8a272');
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
    c.copy(low).lerp(high, THREE.MathUtils.clamp((h + 1.2) / 3, 0, 1));
    if (pathDistance(center) < 0.035) c.lerp(dirt, 0.85);
    c.lerp(dirt, 1 - away(center, TOWN_DIR, 0.2, 0.26));
    c.lerp(scorch, 0.85 * (1 - away(center, SHIP_DIR, 0.04, 0.12)));
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

const wallColors = ['#f4a261', '#e9c46a', '#90be6d', '#f28482', '#84a59d'];
const roofColors = ['#6d597a', '#b56576', '#355070'];
const roofGeo = new THREE.ConeGeometry(2.8, 1.6, 4);
const doorMat = mat('#3b2f3f');
const windowMat = mat('#fff3b0', { emissive: '#ffd166', emissiveIntensity: 0.5 });

function makeHouse(i) {
  const g = new THREE.Group();
  const roof = mesh(roofGeo, mat(roofColors[i % roofColors.length]), 0, 3.2, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(
    mesh(box(3.4, 2.4, 3.4), mat(wallColors[i % wallColors.length]), 0, 1.2, 0),
    roof,
    mesh(box(0.8, 1.4, 0.1), doorMat, 0, 0.7, 1.71),
    mesh(box(0.6, 0.6, 0.1), windowMat, -1.05, 1.5, 1.71),
    mesh(box(0.6, 0.6, 0.1), windowMat, 1.05, 1.5, 1.71),
  );
  return g;
}

function makeFountain() {
  const g = new THREE.Group();
  g.add(
    mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.6, 8), mat('#b8b8c8'), 0, 0.3, 0),
    mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 8), mat('#4cc9f0', { roughness: 0.2 }), 0, 0.6, 0),
  );
  const top = mesh(crystalGeo, crystalMat, 0, 1.4, 0);
  top.scale.set(1.4, 3, 1.4);
  g.add(top);
  return g;
}

function createSky(scene) {
  const starPos = new Float32Array(2000 * 3);
  const rand = makeRandom(7);
  for (let i = 0; i < 2000; i++) {
    randomDir(rand).multiplyScalar(500 + rand() * 300).toArray(starPos, i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false })));

  const giant = new THREE.Group();
  giant.add(new THREE.Mesh(new THREE.IcosahedronGeometry(30, 2), new THREE.MeshBasicMaterial({ color: '#e07a5f' })));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(40, 58, 48),
    new THREE.MeshBasicMaterial({ color: '#f2cc8f', side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
  );
  ring.rotation.x = 1.2;
  giant.add(ring);
  giant.position.set(-220, 140, -260);
  scene.add(giant);

  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), new THREE.MeshBasicMaterial({ color: '#cdd3e0' }));
  moon.position.set(260, -90, 180);
  scene.add(moon);
}

export function createWorld(scene) {
  createSky(scene);
  scene.add(createPlanet());

  const things = new THREE.Group();
  scene.add(things);
  const placed = [];

  const toTownAtShip = towards(SHIP_DIR, TOWN_DIR);
  const ship = makeShip();
  placeOn(ship.obj, SHIP_DIR, toTownAtShip, 0.4);
  ship.obj.rotateZ(0.2);
  ship.obj.rotateX(0.15);
  things.add(ship.obj);
  ship.obj.updateMatrixWorld();
  for (const z of [-2.2, 0, 2.2]) {
    addCollider(ship.obj.localToWorld(new THREE.Vector3(0, 0, z)), 1.5, 1.5);
  }

  const wingDir = offsetDir(SHIP_DIR, 0.12, 2.2);
  const wing = new THREE.Group().add(mesh(box(3, 0.25, 2.2), mat('#d9dde6')));
  placeOn(wing, wingDir, towards(wingDir, TOWN_DIR), 0.1);
  wing.rotateZ(0.35);
  things.add(wing);
  addCollider(wing.position.clone(), 1.3, 0.5);

  const [t1, t2] = tangentBasis(TOWN_DIR);
  const toShip = towards(TOWN_DIR, SHIP_DIR);
  const pathAngle = Math.atan2(toShip.dot(t2), toShip.dot(t1));
  for (let k = 1; k <= 5; k++) {
    const dir = offsetDir(TOWN_DIR, 0.17, pathAngle + (k * Math.PI) / 3);
    const house = placeOn(makeHouse(k), dir, towards(dir, TOWN_DIR));
    things.add(house);
    addCollider(house.position.clone(), 2.4, 3.3, 2);
  }
  const fountain = placeOn(makeFountain(), TOWN_DIR, toShip);
  things.add(fountain);
  addCollider(fountain.position.clone(), 1.5, 0.7);

  const rand = makeRandom(2024);
  function scatter(count, make, sink) {
    for (let n = 0, tries = 0; n < count && tries < count * 40; tries++) {
      const dir = randomDir(rand);
      if (dir.angleTo(SHIP_DIR) < 0.45 || dir.angleTo(TOWN_DIR) < 0.42 || pathDistance(dir) < 0.07) continue;
      if (placed.some((p) => p.angleTo(dir) < 0.07)) continue;
      const { obj, r, top, land } = make(rand);
      const [a, b] = tangentBasis(dir);
      const spin = rand() * Math.PI * 2;
      placeOn(obj, dir, a.multiplyScalar(Math.cos(spin)).addScaledVector(b, Math.sin(spin)), sink);
      things.add(obj);
      placed.push(dir);
      addCollider(obj.position.clone(), r, top, land);
      n++;
    }
  }
  scatter(70, makeTree, 0.1);
  scatter(45, makeRock, 0.15);
  scatter(18, makeCrystals, 0.1);

  const shipSide = new THREE.Vector3().crossVectors(SHIP_DIR, toTownAtShip);
  const spawnAway = toTownAtShip.clone().multiplyScalar(-0.5).addScaledVector(shipSide, 0.87);
  const spawnDir = SHIP_DIR.clone().multiplyScalar(Math.cos(0.2)).addScaledVector(spawnAway, Math.sin(0.2)).normalize();

  return {
    spawnDir,
    spawnFacing: towards(spawnDir, SHIP_DIR),
    update(t) {
      ship.update(t);
      crystalMat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.25;
    },
  };
}
