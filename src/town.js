import * as THREE from 'three';
import {
  RADIUS, SHIP_DIR, makeRandom, tangentBasis, towards, addCollider, addBox, placeAt, warpPoint,
  mat, mesh, box, grassColor, Batcher,
} from './geo.js';
import { furnish, CEILING } from './interiors.js';
import { SERVICES } from './services.js';

// The town sits on the far side of the planet from the ship.
export const TOWN_DIR = new THREE.Vector3(0, Math.cos(2.6), Math.sin(2.6));
export const TOWN_CORE = 88;
export const TOWN_EDGE = 98;

const SCALE = Math.sqrt(10); // buildings have 10x the floor space they used to
const LEVEL_H = 4.5;
const PLATEAU = 31; // the raised bank plaza is a square, 31 from the middle to each side
const STAIR_HALF = 1.8;
const STAIR_LEN = 3.5;
const STEPS = 10;
const INNER_ST = 35; // street around the plaza
const INNER_HALF = 2.6;
const FRONT = 38.2; // where the building fronts start
const OUTER_ST = 62; // back street behind the buildings
const OUTER_HALF = 2.4;
const CROSS_HALF = 3; // the 4 streets that cut through the rows
const FLOOR_H = 3.8;

// Directions across the town. T1 points toward the ship, so the main street leads home.
const T1 = towards(TOWN_DIR, SHIP_DIR);
const T2 = new THREE.Vector3().crossVectors(TOWN_DIR, T1);
const AXES = [T1, T2, T1.clone().negate(), T2.clone().negate()].map((a) => ({ a, b: new THREE.Vector3().crossVectors(TOWN_DIR, a) }));

// A spot in town: `x` steps out from the middle along an axis, then `y` steps sideways along that row.
function townPoint(axis, x, y = 0) {
  const p = TOWN_DIR.clone().multiplyScalar(Math.cos(x / RADIUS)).addScaledVector(axis.a, Math.sin(x / RADIUS));
  return p.multiplyScalar(Math.cos(y / RADIUS)).addScaledVector(axis.b, Math.sin(y / RADIUS)).normalize();
}

// The reverse: how far out along the axis a spot is, and how far sideways along its row.
function rowCoords(dir, axis) {
  const da = dir.dot(axis.a);
  const dt = dir.dot(TOWN_DIR);
  const x = Math.atan2(da, dt);
  const along = Math.cos(x) * dt + Math.sin(x) * da;
  return { x: x * RADIUS, y: Math.atan2(dir.dot(axis.b), along) * RADIUS };
}

// Direction pointing away from the town middle, across a row line.
const rowNormal = (axis, x) => axis.a.clone().multiplyScalar(Math.cos(x / RADIUS)).addScaledVector(TOWN_DIR, -Math.sin(x / RADIUS));

function stairAt(dir) {
  for (const axis of AXES) {
    const { x, y } = rowCoords(dir, axis);
    if (Math.abs(y) < STAIR_HALF && Math.abs(x - PLATEAU) < STAIR_LEN) return x - PLATEAU;
  }
  return null;
}

function plateauInside(dir) {
  let inside = Infinity;
  for (const axis of AXES) inside = Math.min(inside, PLATEAU - rowCoords(dir, axis).x);
  return inside;
}

export function townHeight(dir) {
  const along = stairAt(dir);
  if (along !== null) return (LEVEL_H * (STAIR_LEN - along)) / (2 * STAIR_LEN);
  return LEVEL_H * THREE.MathUtils.smoothstep(plateauInside(dir), -0.8, 0.8);
}

// Streets (saved for alien NPCs to walk on later). A "ring" street runs along a row line;
// a "cross" street runs straight out from the middle along an axis.
// Where the row line `x` out along one axis meets the row line `other` out along the next axis.
// (On a small round planet these "square" lines bend toward each other near the corners.)
const cornerY = (x, other = x) => Math.atan(Math.tan(other / RADIUS) * Math.cos(x / RADIUS)) * RADIUS;

export const townRoads = [];
for (const axis of AXES) {
  const inner = cornerY(INNER_ST) + INNER_HALF;
  const outer = cornerY(OUTER_ST) + OUTER_HALF;
  townRoads.push({ kind: 'ring', axis, x: INNER_ST, from: -inner, to: inner, half: INNER_HALF });
  townRoads.push({ kind: 'ring', axis, x: OUTER_ST, from: -outer, to: outer, half: OUTER_HALF });
  const end = axis.a === T1 ? TOWN_EDGE + 3 : OUTER_ST + 8;
  townRoads.push({ kind: 'cross', axis, from: PLATEAU + STAIR_LEN, to: end, half: CROSS_HALF });
}

function roadGap(dir) {
  let best = Infinity;
  for (const r of townRoads) {
    const { x, y } = rowCoords(dir, r.axis);
    if (r.kind === 'ring') {
      if (y >= r.from && y <= r.to) best = Math.min(best, Math.abs(x - r.x) - r.half);
    } else if (x >= r.from && x <= r.to) {
      best = Math.min(best, Math.abs(y) - r.half);
    }
  }
  return best;
}

export const townWalkways = {
  roads: townRoads,
  stairs: AXES.map((axis) => ({ bottom: townPoint(axis, PLATEAU + STAIR_LEN), top: townPoint(axis, PLATEAU - STAIR_LEN) })),
  plaza: { center: TOWN_DIR.clone(), halfSize: PLATEAU - 1 },
  get doors() { return buildingDoors; },
  get services() { return buildingServices; },
  get vaults() { return vaultDoors; },
  point: (axisIndex, x, y) => townPoint(AXES[axisIndex], x, y),
};
export const TOWN_GATE = townPoint(AXES[0], 72);

const M = {
  stone: mat('#8d8478'),
  stoneWall: mat('#a39a8c'),
  plaster: mat('#ddd0b4'),
  plasterWarm: mat('#d9bf94'),
  timber: mat('#4a3222'),
  planks: ['#8b5a2b', '#7a4e2d', '#9c6b3f'].map((c) => mat(c)),
  floor: mat('#a07850'),
  roofs: ['#6b3e26', '#8a5a2b', '#5b4a3a', '#7d3c2a', '#b8964f'].map((c) => mat(c)),
  window: mat('#2a2018'),
  shutter: mat('#5a3a22'),
  wood: mat('#8a6239'),
  woodDark: mat('#5e4128'),
  iron: mat('#3b3b3b'),
  hay: mat('#d9b85c'),
  water: mat('#3d6e8c', { roughness: 0.2 }),
  cloth: ['#b5523b', '#d9a441', '#4f7a5a', '#6b4c8a'].map((c) => mat(c)),
  flame: mat('#ffb347', { emissive: '#ff8c1a', emissiveIntensity: 1.5 }),
  linen: mat('#efe9dc'),
  signBoard: mat('#5a3a22'),
  bankStone: mat('#d8cfbd'),
  slate: mat('#4f5560'),
  gold: mat('#d4a017', { metalness: 0.6, roughness: 0.35, emissive: '#4a3500', emissiveIntensity: 0.4 }),
  silver: mat('#c9ced6', { metalness: 0.6, roughness: 0.3, emissive: '#2a2d33', emissiveIntensity: 0.4 }),
  sack: mat('#a08560'),
  pot: mat('#9c5a3c'),
  leaf: mat('#5f9e4f'),
  carpet: mat('#8c2f2f'),
  bread: mat('#c68b4e'),
  meat: mat('#b5524a'),
  cheese: mat('#f2c14e'),
  leather: mat('#6b4226'),
};

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// Sizes are the old building sizes; `big` gives them 10x the floor space.
const big = (spec) => ({
  ...spec,
  w: spec.w * SCALE,
  d: spec.d * SCALE,
  h: spec.h * SCALE,
  door: spec.door ?? 2.8,
  doorH: spec.doorH ?? 3.8,
});
const shop = (name, extra = {}) => big({ name, w: 6.5, d: 5, h: 3.6, awning: true, inside: 'shop', wall: M.planks[2], ...extra });
const hotel = (name) => big({ name, w: 10, d: 6, h: 6.4, door: 3.2, doorH: 4.2, balcony: true, inside: 'hotel', wall: M.planks[0] });

// Every one of these gets built first; then the rows fill up with EXTRA_SHOPS.
const SHOP_TYPES = [
  hotel('INN & HOTEL'),
  big({ name: 'HOSPITAL', w: 11, d: 6, h: 4.6, door: 3.4, doorH: 4.2, inside: 'hospital', wall: M.stoneWall }),
  shop('GENERAL STORE', { w: 7.5, d: 5.5, h: 3.8, wall: M.plaster, frame: true }),
  big({ name: 'TAVERN', w: 9, d: 6, h: 4.2, inside: 'tavern', wall: M.planks[1] }),
  big({ name: 'BLACKSMITH', w: 7, d: 5.5, h: 3.6, door: 3.2, inside: 'forge', wall: M.stoneWall, chimney: true }),
  shop('BAKERY', { wall: M.plasterWarm, frame: true, chimney: true }),
  shop('POST OFFICE', { wall: M.plaster, frame: true, awning: false }),
  shop('TAILOR'),
  big({ name: 'LIBRARY', w: 8, d: 5.5, h: 4.8, door: 3, inside: 'books', wall: M.stoneWall }),
];
const EXTRA_SHOPS = [
  shop('GROCER', { wall: M.planks[1] }),
  shop('POTION SHOP', { wall: M.plaster, frame: true }),
  big({ name: 'CLINIC', w: 8, d: 5.5, h: 3.8, inside: 'hospital', wall: M.stoneWall }),
  shop('CARPENTER', { wall: M.planks[0], awning: false }),
  shop('BUTCHER', { wall: M.plasterWarm, frame: true }),
  shop('TOY SHOP', { wall: M.planks[2] }),
  big({ name: 'BOOK SHOP', w: 6.5, d: 5, h: 3.8, inside: 'books', wall: M.plaster, frame: true }),
  shop('FARM SUPPLY', { wall: M.planks[1], awning: false }),
  hotel('BOARDING HOUSE'),
  shop('CANDLE MAKER', { wall: M.plasterWarm, frame: true }),
  shop('POTTER', { wall: M.planks[0] }),
  // Narrower ones that fill the leftover gaps at the ends of rows.
  shop('HERBALIST', { w: 4, d: 5.7, h: 3.4, wall: M.plaster, frame: true, awning: false }),
  shop('SHOEMAKER', { w: 4, d: 5.7, h: 3.4, wall: M.planks[1], awning: false }),
  shop('CHEESE SHOP', { w: 4, d: 5.7, h: 3.4, wall: M.plasterWarm, frame: true, awning: false }),
  shop('STABLE', { w: 4.2, d: 5.7, h: 3.4, wall: M.planks[0], awning: false, inside: 'stable' }),
];

function signMaterial(text, w, h, colors = {}) {
  if (typeof document === 'undefined') return M.signBoard;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round((1024 * h) / w);
  const g = canvas.getContext('2d');
  g.fillStyle = colors.bg ?? '#5a3a22';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = colors.edge ?? '#2e1d10';
  g.lineWidth = 16;
  g.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  let size = Math.round(canvas.height * 0.55);
  const font = () => `bold ${size}px Georgia, 'Times New Roman', serif`;
  g.font = font();
  while (g.measureText(text).width > canvas.width - 80 && size > 12) {
    size -= 2;
    g.font = font();
  }
  g.fillStyle = colors.text ?? '#f1e2bf';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
}

// Evenly spaced spots along a wall of length `len`, about every `gap` steps.
function spread(len, gap, edge = 1.5) {
  const n = Math.max(1, Math.floor((len - 2 * edge) / gap));
  return Array.from({ length: n }, (_, i) => -len / 2 + edge + ((i + 0.5) * (len - 2 * edge)) / n);
}

function buildBuilding(rand, spec) {
  const wallMat = spec.wall;
  const roofMat = spec.roof ?? pick(rand, M.roofs);
  const { w, d } = spec;
  const wallH = spec.h;
  const g = new THREE.Group();
  const boxes = [];
  const T = 0.4;
  const BASE = spec.base ?? 0.3;
  const DOOR = spec.door;
  const DOOR_H = spec.doorH;
  const top = BASE + wallH;
  const part = (geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const solid = (geo, material, x, y, z, y1) => {
    const m = part(geo, material, x, y, z);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    boxes.push({ x, z, hx: (bb.max.x - bb.min.x) / 2, hz: (bb.max.z - bb.min.z) / 2, y0: -2, y1 });
    return m;
  };
  const wall = (x, z, bw, bd, y0 = 0) => {
    part(box(bw, wallH - y0, bd), wallMat, x, BASE + (y0 + wallH) / 2, z);
    boxes.push({ x, z, hx: bw / 2, hz: bd / 2, y0: y0 === 0 ? -2 : BASE + y0, y1: top });
  };

  part(box(w + 0.6, BASE + 1, d + 0.6), M.stone, 0, (BASE - 1) / 2, 0);
  part(box(w - 2 * T, 0.06, d - 2 * T), M.floor, 0, BASE + 0.03, 0);
  boxes.push({ x: 0, z: 0, hx: w / 2 + 0.3, hz: d / 2 + 0.3, y0: -2, y1: BASE + 0.06 });

  const seg = (w - DOOR) / 2;
  wall(0, -d / 2 + T / 2, w, T);
  wall(-w / 2 + T / 2, 0, T, d - 2 * T);
  wall(w / 2 - T / 2, 0, T, d - 2 * T);
  wall(-w / 2 + seg / 2, d / 2 - T / 2, seg, T);
  wall(w / 2 - seg / 2, d / 2 - T / 2, seg, T);
  wall(0, d / 2 - T / 2, DOOR, T, DOOR_H);

  if (spec.frame) {
    const beam = (bw, bd, x, y, z) => part(box(bw, 0.4, bd), M.timber, x, y, z);
    for (const x of [...spread(w, 6, 0.25), -w / 2 + 0.2, w / 2 - 0.2]) {
      part(box(0.5, wallH, 0.55), M.timber, x, BASE + wallH / 2, -d / 2 + 0.15);
      if (Math.abs(x) > DOOR / 2 + 0.4) part(box(0.5, wallH, 0.55), M.timber, x, BASE + wallH / 2, d / 2 - 0.15);
    }
    for (const z of spread(d, 6, 0.25)) {
      for (const sx of [-1, 1]) part(box(0.55, wallH, 0.5), M.timber, sx * (w / 2 - 0.15), BASE + wallH / 2, z);
    }
    for (let y = BASE + FLOOR_H; y < top; y += FLOOR_H) {
      for (const sz of [-1, 1]) beam(w + 0.1, 0.55, 0, y, sz * (d / 2 - 0.15));
      for (const sx of [-1, 1]) beam(0.55, d, sx * (w / 2 - 0.15), y, 0);
    }
    for (const sz of [-1, 1]) beam(w + 0.1, 0.55, 0, top - 0.2, sz * (d / 2 - 0.15));
    for (const sx of [-1, 1]) part(box(0.3, DOOR_H, 0.6), M.timber, sx * (DOOR / 2 + 0.15), BASE + DOOR_H / 2, d / 2 - 0.15);
    part(box(DOOR + 0.6, 0.35, 0.6), M.timber, 0, BASE + DOOR_H + 0.17, d / 2 - 0.15);
  }

  const windowAt = (x, y, z, rotY) => {
    const wg = new THREE.Group();
    wg.add(
      new THREE.Mesh(box(0.9, 0.8, 0.06), M.window),
      new THREE.Mesh(box(0.42, 0.86, 0.05), M.shutter),
      new THREE.Mesh(box(0.42, 0.86, 0.05), M.shutter),
      new THREE.Mesh(box(1.1, 0.1, 0.18), M.timber),
    );
    wg.children[1].position.set(-0.68, 0, 0.02);
    wg.children[2].position.set(0.68, 0, 0.02);
    wg.children[3].position.set(0, -0.45, 0.05);
    wg.position.set(x, y, z);
    wg.rotation.y = rotY;
    wg.scale.setScalar(1.6);
    g.add(wg);
  };
  const signH = Math.min(2.2, (wallH - DOOR_H) * 0.5);
  const signTop = BASE + DOOR_H + 0.5 + signH;
  const rows = [];
  for (let y = BASE + 2.2; y < top - 1.6; y += FLOOR_H) rows.push(y);
  rows.forEach((y, row) => {
    for (const x of spread(w, 4.5)) {
      windowAt(x, y, -d / 2 - 0.03, Math.PI);
      const blocked = Math.abs(x) < DOOR / 2 + 1.8 && (row === 0 || y - 0.8 < signTop);
      if (!blocked) windowAt(x, y, d / 2 + 0.03, 0);
      if (row === 0 && !blocked && spec.awning) {
        const awning = part(box(2.4, 0.08, 1.4), pick(rand, M.cloth), x, y + 1.15, d / 2 + 0.7);
        awning.rotation.x = 0.4;
      }
    }
    for (const z of spread(d, 4.5)) {
      for (const sx of [-1, 1]) windowAt(sx * (w / 2 + 0.03), y, z, sx * (Math.PI / 2));
    }
  });

  const over = 0.6;
  const halfSpan = d / 2 + over;
  const rh = d * 0.28;
  const angle = Math.atan2(rh, halfSpan);
  for (const s of [-1, 1]) {
    const slab = part(box(w + 2 * over, 0.3, Math.hypot(halfSpan, rh)), roofMat, 0, top + rh / 2 + 0.15, (s * halfSpan) / 2);
    slab.rotation.x = s * angle;
  }
  part(box(w + 2 * over + 0.2, 0.4, 0.5), M.timber, 0, top + rh + 0.25, 0);
  const gable = new THREE.ExtrudeGeometry(
    new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rh * 0.97)]),
    { depth: w, bevelEnabled: false },
  );
  gable.rotateY(Math.PI / 2);
  gable.translate(-w / 2, 0, 0);
  part(gable, wallMat, 0, top, 0);
  if (spec.chimney) part(box(1.8, rh + 3, 1.8), M.stone, w / 2 - 2.5, top + (rh + 3) / 2 - 0.4, -d / 4);
  boxes.push({ x: 0, z: 0, hx: w / 2 + over, hz: d / 2 + over, y0: top, y1: top + rh * 0.55 });

  if (spec.name && spec.sign !== false) {
    const signW = Math.min(w * 0.7, signH * 5);
    part(box(signW, signH, 0.15), signMaterial(spec.name, signW, signH), 0, signTop - signH / 2, d / 2 + 0.08);
  }
  if (spec.balcony) {
    const y = BASE + FLOOR_H + 0.3;
    part(box(w - 1, 0.2, 2), M.wood, 0, y, d / 2 + 1);
    boxes.push({ x: 0, z: d / 2 + 1, hx: w / 2 - 0.5, hz: 1, y0: y - 0.1, y1: y + 0.1 });
    part(box(w - 1, 0.1, 0.1), M.woodDark, 0, y + 1, d / 2 + 1.95);
    for (let x = -w / 2 + 0.6; x <= w / 2 - 0.6; x += 0.8) part(box(0.08, 1, 0.08), M.woodDark, x, y + 0.5, d / 2 + 1.95);
    for (const x of spread(w, 8, 0.6)) part(box(0.3, y, 0.3), M.woodDark, x, y / 2, d / 2 + 1.85);
  }

  const floorY = BASE + 0.06;
  if (spec.ceiling !== false) {
    const y = floorY + CEILING;
    part(box(w - 2 * T, 0.3, d - 2 * T), M.floor, 0, y + 0.15, 0);
    for (const z of spread(d, 3, 0.6)) part(box(w - 2 * T, 0.3, 0.3), M.timber, 0, y - 0.15, z);
    boxes.push({ x: 0, z: 0, hx: w / 2 - T, hz: d / 2 - T, y0: y, y1: y + 0.3 });
  }
  const ctx = {
    part, solid, rand, M, w, d, floorY, stations: [], rooms: [],
    stock: SERVICES[spec.name]?.stock,
    label: (text) => signMaterial(text, 0.6, 0.38),
  };
  furnish(spec.inside, ctx);

  return { obj: g, boxes, part, solid, top, BASE, ctx };
}

const BANK = { w: 13 * SCALE, d: 9 * SCALE, h: 7 * SCALE, portico: 7, back: 3.5 };

function buildBank(rand) {
  const { w, d } = BANK;
  const bank = buildBuilding(rand, {
    name: 'BANK', sign: false, ceiling: false, w, d, h: BANK.h, door: 5, doorH: 7, base: 1.2, wall: M.bankStone, roof: M.slate,
  });
  const { part, solid, boxes, top, BASE } = bank;
  const front = d / 2;
  const P = BANK.portico;

  solid(box(w + 0.6, BASE + 1, P), M.bankStone, 0, (BASE - 1) / 2, front + P / 2, BASE);
  solid(box(w + 0.6, 1.8, 0.8), M.bankStone, 0, -0.1, front + P + 0.4, 0.8);
  solid(box(w + 0.6, 1.4, 0.8), M.bankStone, 0, -0.3, front + P + 1.2, 0.4);
  for (const x of [-19, -14.5, -9.5, -4.5, 4.5, 9.5, 14.5, 19]) {
    part(new THREE.CylinderGeometry(1.05, 1.15, BANK.h, 14), M.bankStone, x, BASE + BANK.h / 2, front + P - 1.4);
    part(box(2.6, 0.7, 2.6), M.bankStone, x, BASE + 0.35, front + P - 1.4);
    part(box(2.6, 0.7, 2.6), M.bankStone, x, top - 0.35, front + P - 1.4);
    boxes.push({ x, z: front + P - 1.4, hx: 1.2, hz: 1.2, y0: -2, y1: top });
  }
  part(box(w + 0.6, 2.2, P + 0.4), M.bankStone, 0, top + 1.1, front + P / 2);
  boxes.push({ x: 0, z: front + P / 2, hx: w / 2 + 0.3, hz: P / 2 + 0.2, y0: top, y1: top + 2.2 });
  part(box(w + 1, 0.5, 0.5), M.gold, 0, top + 2.3, front + P + 0.15);
  const pediment = new THREE.ExtrudeGeometry(
    new THREE.Shape([new THREE.Vector2(-(w + 0.6) / 2, 0), new THREE.Vector2((w + 0.6) / 2, 0), new THREE.Vector2(0, 6)]),
    { depth: 1, bevelEnabled: false },
  );
  part(pediment, M.bankStone, 0, top + 2.2, front + P - 0.8);
  const emblem = part(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 20), M.gold, 0, top + 4.3, front + P + 0.3);
  emblem.rotation.x = Math.PI / 2;
  part(box(14, 1.8, 0.2), signMaterial('BANK', 14, 1.8, { bg: '#3a3328', edge: '#e8c25a', text: '#e8c25a' }), 0, top + 1.1, front + P + 0.3);

  const floorY = BASE + 0.06;
  bank.lights = [];
  for (const x of [-13, 0, 13]) {
    for (const z of [7, -5]) {
      part(box(0.1, 6, 0.1), M.iron, x, top - 3, z);
      part(new THREE.CylinderGeometry(2, 2, 0.15, 12), M.iron, x, top - 6, z);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        part(box(0.15, 0.45, 0.15), M.flame, x + Math.cos(a) * 1.8, top - 5.7, z + Math.sin(a) * 1.8);
      }
      if (x !== 0) bank.lights.push(new THREE.Vector3(x, top - 7, z));
    }
  }
  solid(box(w - 10, 1.3, 0.9), M.woodDark, 0, floorY + 0.65, 1.5, floorY + 1.3);
  for (let x = -w / 2 + 5.5; x <= w / 2 - 5.5; x += 3) part(box(0.12, 2.2, 0.12), M.gold, x, floorY + 2.4, 1.5);

  // Three vault rooms of different sizes along the back wall, each full of coins.
  const back = -d / 2 + 0.4;
  bank.vaults = [];
  const stack = (material, x, z, coins) => part(new THREE.CylinderGeometry(0.17, 0.17, coins * 0.06, 10), material, x, floorY + coins * 0.03, z);
  const heap = (material, x, z, radius, height) => part(new THREE.ConeGeometry(radius, height, 9), material, x, floorY + height / 2, z);
  const chest = (x, z) => {
    part(box(1, 0.6, 0.65), M.woodDark, x, floorY + 0.3, z);
    part(box(1.04, 0.08, 0.69), M.gold, x, floorY + 0.45, z);
    part(new THREE.ConeGeometry(0.42, 0.3, 8), M.gold, x, floorY + 0.75, z);
  };
  const bars = (x, z) => {
    for (let layer = 0; layer < 4; layer++) {
      for (let i = 0; i < 4 - layer; i++) {
        part(box(0.45, 0.15, 0.22), M.gold, x + (i - (3 - layer) / 2) * 0.48, floorY + 0.075 + layer * 0.15, z);
      }
    }
  };
  const sack = (x, z) => {
    const s = part(new THREE.IcosahedronGeometry(0.32, 0), M.sack, x, floorY + 0.28, z);
    s.scale.set(1, 0.9, 1);
    part(box(0.12, 0.12, 0.12), M.sack, x, floorY + 0.6, z);
  };
  const vaultRoom = (x0, x1, depth, fill) => {
    const cx = (x0 + x1) / 2;
    const width = x1 - x0;
    const wallH = 7;
    const VT = 0.5;
    const doorW = 2.4;
    const doorH = 3.6;
    const frontZ = back + depth;
    const ironWall = (x, z, bw, bd) => solid(box(bw, wallH, bd), M.iron, x, floorY + wallH / 2, z, floorY + wallH);
    ironWall(x0 + VT / 2, back + depth / 2, VT, depth);
    ironWall(x1 - VT / 2, back + depth / 2, VT, depth);
    const seg = (width - doorW) / 2;
    ironWall(x0 + seg / 2, frontZ - VT / 2, seg, VT);
    ironWall(x1 - seg / 2, frontZ - VT / 2, seg, VT);
    part(box(doorW, wallH - doorH, VT), M.iron, cx, floorY + doorH + (wallH - doorH) / 2, frontZ - VT / 2);
    part(box(width + 0.2, 0.4, depth + 0.2), M.iron, cx, floorY + wallH + 0.2, back + depth / 2);
    boxes.push({ x: cx, z: back + depth / 2, hx: width / 2, hz: depth / 2, y0: floorY + doorH, y1: floorY + wallH + 0.4 });
    for (const sx of [-1, 1]) part(box(0.2, doorH, 0.2), M.gold, cx + sx * (doorW / 2 + 0.1), floorY + doorH / 2, frontZ + 0.02);
    bank.vaults.push({ name: ['SMALL', 'MEDIUM', 'LARGE'][bank.vaults.length], x: cx, z: frontZ, doorW, doorH, floorY });
    const stacks = (count, goldShare) => {
      for (let i = 0; i < count; i++) {
        const x = x0 + 1 + rand() * (width - 2);
        const z = back + 0.7 + rand() * (depth - 2.6);
        if (Math.abs(x - cx) < doorW / 2 + 0.3 && z > frontZ - 3) continue;
        stack(rand() < goldShare ? M.gold : M.silver, x, z, 4 + Math.floor(rand() * 12));
      }
    };
    fill(cx, stacks);
  };

  vaultRoom(-w / 2 + 0.5, -12.1, 7, (cx, stacks) => {
    heap(M.silver, cx - 1, back + 2.2, 1.6, 1.1);
    stacks(60, 0.15);
    for (const dx of [-2.5, 0, 2.5]) sack(cx + dx, back + 4.6);
  });
  vaultRoom(-11.6, 1.4, 9, (cx, stacks) => {
    heap(M.silver, cx - 3, back + 2.6, 2.4, 1.6);
    heap(M.gold, cx + 3, back + 2.2, 1.7, 1.2);
    stacks(90, 0.45);
    for (const dx of [-4.5, 0, 4.5]) chest(cx + dx, back + 6);
    for (const dx of [-5.5, -2, 2, 5.5]) sack(cx + dx, back + 0.9);
  });
  vaultRoom(1.9, w / 2 - 0.5, 11.3, (cx, stacks) => {
    heap(M.gold, cx, back + 3.6, 3.6, 2.8);
    heap(M.silver, cx - 6, back + 2.4, 2.2, 1.5);
    heap(M.gold, cx + 6, back + 2.2, 2, 1.4);
    for (const dx of [-6.5, -2.5, 2.5, 6.5]) bars(cx + dx, back + 8.2);
    for (const dx of [-7, -4, 4, 7]) chest(cx + dx, back + 6.2);
    for (const dx of [-7.5, 7.5]) chest(cx + dx, back + 9.3);
    stacks(140, 0.7);
  });
  furnish('bankLobby', bank.ctx);
  return bank;
}

function makeBarrel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 10), M.wood, 0, 0.5, 0));
  for (const y of [0.2, 0.8]) g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), M.iron, 0, y, 0));
  return { obj: g, r: 0.45, top: 1 };
}

function makeCrate(rand) {
  const g = new THREE.Group();
  const stacked = rand() < 0.4;
  g.add(mesh(box(0.9, 0.9, 0.9), M.wood, 0, 0.45, 0));
  if (stacked) {
    const top = mesh(box(0.8, 0.8, 0.8), M.woodDark, 0.05, 1.3, 0);
    top.rotation.y = 0.4;
    g.add(top);
  }
  return { obj: g, r: 0.55, top: stacked ? 1.7 : 0.9 };
}

function makeHay() {
  const g = new THREE.Group().add(mesh(box(1.3, 0.75, 0.85), M.hay, 0, 0.375, 0));
  return { obj: g, r: 0.65, top: 0.75 };
}

function makeCart() {
  const g = new THREE.Group();
  g.add(mesh(box(1.4, 0.15, 2.2), M.wood, 0, 0.75, 0));
  for (const sx of [-1, 1]) {
    g.add(mesh(box(0.1, 0.45, 2.2), M.woodDark, sx * 0.7, 1, 0));
    const wheel = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.15, 10), M.woodDark, sx * 0.85, 0.55, -0.2);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel, mesh(box(0.08, 0.08, 1.6), M.wood, sx * 0.35, 0.7, 1.8));
  }
  g.add(mesh(box(1.1, 0.5, 0.9), M.hay, 0, 1.05, -0.4));
  return { obj: g, r: 1.2, top: 1.1 };
}

function makeLantern() {
  const g = new THREE.Group();
  g.add(
    mesh(box(0.18, 2.8, 0.18), M.woodDark, 0, 1.4, 0),
    mesh(box(0.12, 0.12, 0.8), M.woodDark, 0, 2.7, 0.35),
    mesh(box(0.3, 0.38, 0.3), M.flame, 0, 2.4, 0.65),
    mesh(box(0.4, 0.08, 0.4), M.iron, 0, 2.63, 0.65),
  );
  return g;
}

function makeWell() {
  const g = new THREE.Group();
  g.add(
    mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.9, 12), M.stone, 0, 0.45, 0),
    mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 12), M.water, 0, 0.8, 0),
    mesh(box(0.2, 2.4, 0.2), M.woodDark, -1.1, 1.2, 0),
    mesh(box(0.2, 2.4, 0.2), M.woodDark, 1.1, 1.2, 0),
    mesh(box(2.4, 0.12, 0.12), M.woodDark, 0, 2.1, 0),
    mesh(box(0.35, 0.35, 0.35), M.wood, 0, 1.5, 0),
  );
  for (const s of [-1, 1]) {
    const slab = mesh(box(2.8, 0.12, 1.2), M.roofs[0], 0, 2.6, s * 0.45);
    slab.rotation.x = s * 0.6;
    g.add(slab);
  }
  return g;
}

function makeStall(rand) {
  const g = new THREE.Group();
  g.add(mesh(box(2.4, 0.9, 0.8), M.wood, 0, 0.45, 0.4));
  for (const sx of [-1.15, 1.15]) {
    for (const sz of [-0.6, 0.8]) g.add(mesh(box(0.14, 2.5, 0.14), M.woodDark, sx, 1.25, sz));
  }
  const canopy = mesh(box(2.8, 0.08, 2), pick(rand, M.cloth), 0, 2.55, 0.1);
  canopy.rotation.x = 0.15;
  g.add(canopy);
  return g;
}

let groundAt;

function place(obj, dir, facingDir) {
  return placeAt(obj, dir, towards(dir, facingDir), RADIUS + groundAt(dir));
}

// Turns a building's collision boxes into planet-shaped ones (small pieces, so they follow the curve).
function addBoxesFrom(obj, boxes, curved = false) {
  const base = obj.position.length();
  const at = (x, z) => {
    const p = obj.localToWorld(new THREE.Vector3(x, 0, z));
    return curved ? warpPoint(p, obj.position) : p;
  };
  for (const b of boxes) {
    const nx = Math.max(1, Math.ceil(b.hx / 3));
    const nz = Math.max(1, Math.ceil(b.hz / 3));
    const hx = b.hx / nx;
    const hz = b.hz / nz;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = b.x - b.hx + hx * (2 * i + 1);
        const z = b.z - b.hz + hz * (2 * j + 1);
        const pos = at(x, z);
        const up = pos.clone().normalize();
        const ax = at(x + 0.5, z).sub(at(x - 0.5, z));
        const az = at(x, z + 0.5).sub(at(x, z - 0.5));
        ax.addScaledVector(up, -ax.dot(up)).normalize();
        az.addScaledVector(up, -az.dot(up)).normalize();
        addBox(pos, ax, az, hx, hz, base + b.y0, base + b.y1);
      }
    }
  }
}

function buildGround() {
  const step = 0.8;
  const n = Math.ceil((TOWN_EDGE + 1) / step);
  const size = 2 * n + 1;
  const [U, V] = tangentBasis(TOWN_DIR);
  const dirAt = (u, v) => {
    const dist = Math.hypot(u, v);
    if (dist < 1e-6) return TOWN_DIR.clone();
    const s = Math.sin(dist / RADIUS) / dist;
    return TOWN_DIR.clone().multiplyScalar(Math.cos(dist / RADIUS)).addScaledVector(U, u * s).addScaledVector(V, v * s);
  };
  const points = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const dir = dirAt((i - n) * step, (j - n) * step);
      points.push(dir.multiplyScalar(RADIUS + groundAt(dir)));
    }
  }

  const positions = [];
  const colors = [];
  const rand = makeRandom(99);
  const color = new THREE.Color();
  const grass = new THREE.Color();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const C = {
    stone: new THREE.Color('#8d8478'),
    dirt: new THREE.Color('#9c7a52'),
    dirtDark: new THREE.Color('#86673f'),
    cobble: new THREE.Color('#a89272'),
    cobbleDark: new THREE.Color('#917c60'),
    yard: new THREE.Color('#8f8a5a'),
    townGrass: new THREE.Color('#93a55a'),
  };

  function colorFor(a, b, c) {
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    mid.copy(a).add(b).add(c);
    const steep = e1.cross(e2).normalize().dot(mid.normalize()) < 0.8;
    if (steep) return color.copy(C.stone).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    const gap = roadGap(mid);
    if (gap < 0) return color.copy(rand() < 0.3 ? C.dirtDark : C.dirt).offsetHSL(0, 0, (rand() - 0.5) * 0.04);
    if (plateauInside(mid) > 0.9) {
      const { x, y } = rowCoords(mid, AXES[0]);
      const odd = (Math.floor(x / 1.2) + Math.floor(y / 1.2)) & 1;
      return color.copy(odd ? C.cobble : C.cobbleDark).offsetHSL(0, 0, (rand() - 0.5) * 0.03);
    }
    const fromMiddle = mid.angleTo(TOWN_DIR) * RADIUS;
    color.copy(fromMiddle < 70 ? C.yard : C.townGrass);
    const wild = THREE.MathUtils.smoothstep(fromMiddle, TOWN_CORE - 4, TOWN_EDGE);
    if (wild > 0) color.lerp(grassColor(groundAt(mid), grass), wild);
    if (gap < 0.8) color.lerp(C.dirt, 0.45);
    return color.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
  }

  function tri(a, b, c) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    colorFor(a, b, c);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  }

  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      if (Math.hypot((i - n + 0.5) * step, (j - n + 0.5) * step) > TOWN_EDGE + 0.5) continue;
      const a = points[i * size + j];
      const b = points[(i + 1) * size + j];
      const c = points[(i + 1) * size + j + 1];
      const d = points[i * size + j + 1];
      tri(a, b, c);
      tri(a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  return ground;
}

function buildStairs(batch) {
  const depth = (2 * STAIR_LEN) / STEPS;
  for (const axis of AXES) {
    for (let i = 0; i < STEPS; i++) {
      const top = (LEVEL_H * (i + 1)) / STEPS;
      const height = top + 0.8;
      const step = new THREE.Group().add(mesh(box(STAIR_HALF * 2 + 0.3, height, depth + 0.02), M.stone, 0, top - height / 2, 0));
      const dir = townPoint(axis, PLATEAU + STAIR_LEN - (i + 0.5) * depth);
      placeAt(step, dir, towards(dir, TOWN_DIR), RADIUS);
      batch.add(step);
      addBoxesFrom(step, [{ x: 0, z: 0, hx: STAIR_HALF + 0.15, hz: depth / 2, y0: -10, y1: top }]);
    }
  }
}

function buildFences(batch) {
  for (const axis of AXES) {
    const posts = [];
    const end = cornerY(PLATEAU - 1);
    for (let y = -end; y <= end; y += (2 * end) / Math.round(end / 1.1)) {
      posts.push(Math.abs(y) < STAIR_HALF + 1 ? null : townPoint(axis, PLATEAU - 1, y));
    }
    posts.forEach((p, i) => {
      if (!p) return;
      batch.add(place(new THREE.Group().add(mesh(box(0.16, 1.1, 0.16), M.woodDark, 0, 0.55, 0)), p, TOWN_DIR));
      const q = posts[i + 1];
      if (!q) return;
      const len = p.angleTo(q) * RADIUS;
      const rail = new THREE.Group().add(
        mesh(box(0.08, 0.1, len + 0.1), M.wood, 0, 0.85, 0),
        mesh(box(0.08, 0.1, len + 0.1), M.wood, 0, 0.45, 0),
      );
      batch.add(place(rail, p.clone().add(q).normalize(), q));
    });
  }
}

const lights = [];
export const placedBuildings = [];
// For each building: a spot outside its front door and a spot just inside (used by tests, and by NPCs later).
export const buildingDoors = [];
// For each building: what it offers (from services.js) and where workers and customers stand.
export const buildingServices = [];

function recordDoor(obj, name, outsideZ, insideZ, stations = [], rooms = []) {
  const at = (x, z) => warpPoint(obj.localToWorld(new THREE.Vector3(x, 0, z)), obj.position).normalize();
  const door = { name, outside: at(0, outsideZ), inside: at(0, insideZ) };
  buildingDoors.push(door);
  buildingServices.push({
    name,
    ...SERVICES[name],
    door,
    stations: stations.map((s) => ({ worker: at(...s.worker), customer: at(...s.customer) })),
    rooms: rooms.map((r) => ({ number: r.number, center: at(...r.center), door: at(...r.door) })),
  });
}

// Vault doors move, so they stay as their own objects. They start closed, and only aliens can open them:
// vault.open(alien) / vault.close(alien) work only when `alien.isAlien` is true.
export const vaultDoors = [];
const movers = [];
const VAULT_OPEN = Math.PI / 2;

function makeVaultDoor(width, height) {
  const pivot = new THREE.Group();
  const door = new THREE.Group();
  door.position.x = width / 2;
  door.add(
    mesh(box(width + 0.3, height + 0.2, 0.5), M.iron, 0, height / 2, 0),
    mesh(box(width - 0.3, height - 0.4, 0.08), M.slate, 0, height / 2, 0.29),
  );
  const wheel = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12), M.gold, 0, height * 0.5, 0.38);
  wheel.rotation.x = Math.PI / 2;
  door.add(wheel, mesh(box(1.4, 0.12, 0.1), M.gold, 0, height * 0.5, 0.48), mesh(box(0.12, 1.4, 0.1), M.gold, 0, height * 0.5, 0.48));
  for (const sx of [-1, 1]) {
    for (const sy of [0.12, 0.88]) door.add(mesh(box(0.2, 0.2, 0.1), M.gold, sx * (width / 2 - 0.15), height * sy, 0.3));
  }
  for (const sy of [0.2, 0.8]) door.add(mesh(box(0.25, 0.5, 0.6), M.gold, -width / 2 - 0.05, height * sy, 0));
  pivot.add(door);
  return pivot;
}

function addVaultDoors(bank) {
  const at = (x, z) => warpPoint(bank.obj.localToWorld(new THREE.Vector3(x, 0, z)), bank.obj.position);
  const tangent = (a, b, up) => {
    const v = b.sub(a);
    return v.addScaledVector(up, -v.dot(up)).normalize();
  };
  for (const v of bank.vaults) {
    const z = v.z - 0.25;
    const hingeX = v.x - v.doorW / 2;
    const hinge = at(hingeX, z);
    const up = hinge.clone().normalize();
    const radius = bank.obj.position.length() + v.floorY;
    const pivot = makeVaultDoor(v.doorW, v.doorH);
    placeAt(pivot, up, tangent(at(hingeX, z - 0.5), at(hingeX, z + 0.5), up), radius);
    const closed = pivot.quaternion.clone();
    movers.push(pivot);

    const center = at(v.x, z);
    const cUp = center.clone().normalize();
    const collider = addBox(
      center, tangent(at(v.x - 0.5, z), at(v.x + 0.5, z), cUp), tangent(at(v.x, z - 0.5), at(v.x, z + 0.5), cUp),
      v.doorW / 2, 0.3, radius - 2, radius + v.doorH,
    );
    const swing = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    vaultDoors.push({
      name: `${v.name} VAULT`,
      position: center.clone().setLength(radius),
      angle: 0,
      target: 0,
      get isOpen() {
        return this.target > 0;
      },
      open(by) {
        if (!by?.isAlien) return false;
        this.target = VAULT_OPEN;
        return true;
      },
      close(by) {
        if (!by?.isAlien) return false;
        this.target = 0;
        collider.off = false;
        return true;
      },
      update(dt) {
        const step = 1.2 * dt;
        this.angle += THREE.MathUtils.clamp(this.target - this.angle, -step, step);
        pivot.quaternion.copy(closed).multiply(swing.setFromAxisAngle(yAxis, -this.angle));
        if (this.target > 0 && this.angle > 0.4) collider.off = true;
      },
    });
  }
}

function buildPlaza(batch, rand) {
  const bank = buildBank(rand);
  place(bank.obj, townPoint(AXES[0], -BANK.back), SHIP_DIR);
  batch.add(bank.obj, true);
  addBoxesFrom(bank.obj, bank.boxes, true);
  addVaultDoors(bank);
  for (const spot of bank.lights) {
    const light = new THREE.PointLight('#ffc477', 90, 34, 1.2);
    light.position.copy(warpPoint(bank.obj.localToWorld(spot.clone()), bank.obj.position));
    lights.push(light);
  }
  placedBuildings.push('BANK');
  const bankDepth = BANK.d + BANK.portico + 1.6;
  const bankMiddle = townPoint(AXES[0], -BANK.back + (BANK.portico + 1.6) / 2);
  footprints.push(footprintAt(bankMiddle, townPoint(AXES[0], 40), BANK.w + 0.6, bankDepth));
  recordDoor(bank.obj, 'BANK', BANK.d / 2 + BANK.portico + 3, BANK.d / 2 - 4, bank.ctx.stations);

  const well = place(makeWell(), townPoint(AXES[2], 25), TOWN_DIR);
  batch.add(well);
  addCollider(well.position.clone(), 1.3, 0.9);
  for (const side of [1, 3]) {
    for (const y of [-12, 12]) {
      const stall = place(makeStall(rand), townPoint(AXES[side], 25.5, y), TOWN_DIR);
      batch.add(stall);
      addBoxesFrom(stall, [{ x: 0, z: 0.4, hx: 1.2, hz: 0.4, y0: -2, y1: 0.9 }]);
    }
  }
}

// Footprints of everything built so far, so new buildings never overlap them.
const footprints = [];

function footprintAt(center, frontPoint, w, d) {
  const probe = placeAt(new THREE.Group(), center, towards(center, frontPoint), RADIUS);
  return {
    up: center.clone(),
    ax: new THREE.Vector3(1, 0, 0).applyQuaternion(probe.quaternion),
    az: new THREE.Vector3(0, 0, 1).applyQuaternion(probe.quaternion),
    hw: w / 2,
    hd: d / 2,
  };
}

function footprintPoint(f, x, z) {
  const dist = Math.hypot(x, z);
  if (dist < 1e-9) return f.up.clone();
  const a = dist / RADIUS;
  return f.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.ax, (x / dist) * Math.sin(a)).addScaledVector(f.az, (z / dist) * Math.sin(a));
}

function insideFootprint(f, dir) {
  const c = dir.dot(f.up);
  const t = dir.clone().addScaledVector(f.up, -c);
  const s = t.length();
  if (s < 1e-9) return true;
  t.multiplyScalar((Math.atan2(s, c) * RADIUS) / s);
  return Math.abs(t.dot(f.ax)) < f.hw && Math.abs(t.dot(f.az)) < f.hd;
}

function edgePoints(f, inset = 0.25) {
  const points = [];
  const w = f.hw - inset;
  const d = f.hd - inset;
  for (let x = -w; x <= w + 1e-6; x += (2 * w) / Math.ceil(2 * w)) points.push(footprintPoint(f, x, -d), footprintPoint(f, x, d));
  for (let z = -d; z <= d + 1e-6; z += (2 * d) / Math.ceil(2 * d)) points.push(footprintPoint(f, -w, z), footprintPoint(f, w, z));
  return points;
}

function footprintFits(f) {
  const points = edgePoints(f);
  for (let i = 1; i < 6; i++) {
    for (let j = 1; j < 6; j++) points.push(footprintPoint(f, -f.hw + (i * f.hw) / 3, -f.hd + (j * f.hd) / 3));
  }
  if (points.some((dir) => roadGap(dir) < 0)) return false;
  const reach = Math.hypot(f.hw, f.hd);
  for (const other of footprints) {
    if (f.up.angleTo(other.up) * RADIUS > reach + Math.hypot(other.hw, other.hd)) continue;
    if (points.some((dir) => insideFootprint(other, dir))) return false;
    if (edgePoints(other).some((dir) => insideFootprint(f, dir))) return false;
  }
  return true;
}

// Finds where a building of this size would stand in a row, or null if it doesn't fit there.
function rowSpot(axis, y, w, d) {
  const frontPoint = townPoint(axis, FRONT, y);
  const delta = d / 2 / RADIUS;
  const center = frontPoint.clone().multiplyScalar(Math.cos(delta)).addScaledVector(rowNormal(axis, FRONT), Math.sin(delta)).normalize();
  const f = footprintAt(center, frontPoint, w, d);
  return footprintFits(f) ? { center, frontPoint, f } : null;
}

function placeBuilding(batch, rand, spot, spec) {
  const building = buildBuilding(rand, spec);
  place(building.obj, spot.center, spot.frontPoint);
  batch.add(building.obj, true);
  addBoxesFrom(building.obj, building.boxes, true);
  footprints.push(spot.f);
  placedBuildings.push(spec.name);
  recordDoor(building.obj, spec.name, spec.d / 2 + 2, spec.d / 2 - 3, building.ctx.stations, building.ctx.rooms);
}

function placeProp(batch, rand, dir) {
  const roll = rand();
  const { obj, r, top } = roll < 0.35 ? makeBarrel() : roll < 0.65 ? makeCrate(rand) : roll < 0.85 ? makeHay() : makeCart();
  const [a, b] = tangentBasis(dir);
  const spin = rand() * Math.PI * 2;
  placeAt(obj, dir, a.multiplyScalar(Math.cos(spin)).addScaledVector(b, Math.sin(spin)), RADIUS + groundAt(dir));
  batch.add(obj);
  addCollider(obj.position.clone(), r, top);
}

// Fills the four sides of the square with buildings standing wall to wall.
function buildRows(batch, rand) {
  const queue = [...SHOP_TYPES];
  const usedExtras = new Set();
  const narrowest = Math.min(...EXTRA_SHOPS.map((s) => s.w));

  AXES.forEach((axis, i) => {
    const reach = i % 2 === 0 ? cornerY(FRONT, OUTER_ST - OUTER_HALF) - 0.5 : cornerY(FRONT) - 0.3;
    for (const sign of [1, -1]) {
      let y = CROSS_HALF + 0.4;
      while (reach - y >= narrowest) {
        const room = reach - y;
        const candidates = [
          ...queue,
          ...EXTRA_SHOPS.filter((s) => !usedExtras.has(s)),
          ...EXTRA_SHOPS.filter((s) => usedExtras.has(s)),
        ].filter((s) => s.w <= room);
        let placed = null;
        for (const spec of candidates) {
          for (const shrink of [1, 0.85, 0.7]) {
            const d = Math.max(11, spec.d * shrink);
            const spot = rowSpot(axis, sign * (y + spec.w / 2), spec.w, d);
            if (spot) {
              placed = { spec: { ...spec, d }, spot };
              break;
            }
          }
          if (placed) break;
        }
        if (!placed) {
          y += 2;
          continue;
        }
        const { spec, spot } = placed;
        const original = queue.find((s) => s.name === spec.name);
        if (original) queue.splice(queue.indexOf(original), 1);
        else usedExtras.add(EXTRA_SHOPS.find((s) => s.name === spec.name));
        placeBuilding(batch, rand, spot, spec);
        if (rand() < 0.7) placeProp(batch, rand, townPoint(axis, FRONT - 0.9, sign * (y + 0.9)));
        y += spec.w;
      }
    }
  });
}

function buildLanterns(batch) {
  for (const axis of AXES) {
    for (let y = -55; y <= 55; y += 11) {
      if (Math.abs(y) < CROSS_HALF + 1) continue;
      for (const [x, facing] of [[PLATEAU + 1.2, 1], [OUTER_ST + OUTER_HALF + 0.6, -1]]) {
        if (Math.abs(y) > cornerY(x) - 1) continue;
        const dir = townPoint(axis, x, y);
        const lantern = place(makeLantern(), dir, townPoint(axis, x + facing, y));
        batch.add(lantern);
        addCollider(lantern.position.clone(), 0.25, 2.8);
      }
    }
  }
}

export function createTown(scene, heightAt) {
  groundAt = heightAt;
  const rand = makeRandom(777);
  const town = new THREE.Group();
  scene.add(town);
  town.add(buildGround());

  const batch = new Batcher();
  buildStairs(batch);
  buildFences(batch);
  buildPlaza(batch, rand);
  buildRows(batch, rand);
  buildLanterns(batch);
  batch.build(town);
  lights.forEach((light) => town.add(light));
  movers.forEach((obj) => town.add(obj));
  return {
    update(dt) {
      vaultDoors.forEach((vault) => vault.update(dt));
    },
  };
}
