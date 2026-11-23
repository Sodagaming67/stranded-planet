import * as THREE from 'three';
import {
  RADIUS, SHIP_DIR, makeRandom, tangentBasis, towards, addCollider, addBox, placeAt, mat, mesh, box, grassColor, Batcher,
} from './geo.js';

export const TOWN_DIR = new THREE.Vector3(0, Math.cos(1.15), Math.sin(1.15));
export const TOWN_CORE = 58;
export const TOWN_EDGE = 68;
const LEVEL_H = 3.5;
const STAIR_HALF = 1.7;
const STAIR_LEN = 3;
const STEPS = 8;
const RING0 = 35.5;
const RING1_IN = 4.4;
const RING_OUT = 55;
const LANE_OUT = 3.8;
const SETBACK = 1.3;
const [T1, T2] = tangentBasis(TOWN_DIR);

// The town is laid out on a flat map (u, v) that gets wrapped onto the planet.
export function localToDir(u, v) {
  const d = Math.hypot(u, v);
  if (d < 1e-6) return TOWN_DIR.clone();
  const s = Math.sin(d / RADIUS) / d;
  return TOWN_DIR.clone().multiplyScalar(Math.cos(d / RADIUS)).addScaledVector(T1, u * s).addScaledVector(T2, v * s);
}

export function dirToLocal(dir) {
  const tu = dir.dot(T1);
  const tv = dir.dot(T2);
  const s = Math.hypot(tu, tv);
  if (s < 1e-9) return { u: 0, v: 0 };
  const d = Math.acos(THREE.MathUtils.clamp(dir.dot(TOWN_DIR), -1, 1)) * RADIUS;
  return { u: (tu / s) * d, v: (tv / s) * d };
}

const shipLocal = dirToLocal(SHIP_DIR);
const SHIP_ANGLE = Math.atan2(shipLocal.v, shipLocal.u);

const LEVELS = [
  {
    center: { u: 0, v: 0 },
    radius: (t) => 27 + 2 * Math.sin(3 * t) + Math.sin(5 * t + 1),
    stairAngles: [0, 1, 2, 3].map((k) => SHIP_ANGLE + (k * Math.PI) / 2),
  },
  {
    center: { u: 3, v: -2 },
    radius: (t) => 12.5 + 0.8 * Math.sin(4 * t + 2),
    stairAngles: [0.4, 2.5, 4.6].map((a) => SHIP_ANGLE + a),
  },
];
LEVELS.forEach((lv, i) => {
  lv.low = i * LEVEL_H;
  lv.high = (i + 1) * LEVEL_H;
  lv.stairs = lv.stairAngles.map((t) => {
    const axis = { u: Math.cos(t), v: Math.sin(t) };
    const r = lv.radius(t);
    return { axis, at: { u: lv.center.u + axis.u * r, v: lv.center.v + axis.v * r } };
  });
});

const pointAlong = (s, a) => ({ u: s.at.u + s.axis.u * a, v: s.at.v + s.axis.v * a });

function stairAt(lv, u, v, extra = 0) {
  for (const s of lv.stairs) {
    const pu = u - s.at.u;
    const pv = v - s.at.v;
    const along = pu * s.axis.u + pv * s.axis.v;
    const across = Math.abs(pu * s.axis.v - pv * s.axis.u);
    if (across < STAIR_HALF + extra && Math.abs(along) < STAIR_LEN + extra) return along;
  }
  return null;
}

const nearStairs = (u, v, extra) => LEVELS.some((lv) => stairAt(lv, u, v, extra) !== null);

function levelAmount(lv, u, v) {
  const along = stairAt(lv, u, v);
  if (along !== null) return (STAIR_LEN - along) / (2 * STAIR_LEN);
  const du = u - lv.center.u;
  const dv = v - lv.center.v;
  const inside = lv.radius(Math.atan2(dv, du)) - Math.hypot(du, dv);
  return THREE.MathUtils.smoothstep(inside, -0.7, 0.7);
}

export function townHeight(u, v) {
  return LEVEL_H * (levelAmount(LEVELS[0], u, v) + levelAmount(LEVELS[1], u, v));
}

// Roads, stairs and the plaza are saved so alien NPCs can walk along them later.
export const townRoads = [];
function road(points, half) {
  for (let i = 0; i < points.length - 1; i++) townRoads.push({ a: points[i], b: points[i + 1], half });
}
function ringPoints(radiusAt, n = 96) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const r = radiusAt(t);
    return { u: r * Math.cos(t), v: r * Math.sin(t) };
  });
}
road(ringPoints(() => RING0), 1.8);
road(ringPoints((t) => LEVELS[0].radius(t) - RING1_IN), 1.4);
road(ringPoints(() => RING_OUT), 1.6);
road(ringPoints((t) => LEVELS[1].radius(t) + LANE_OUT).map((p) => ({ u: p.u + LEVELS[1].center.u, v: p.v + LEVELS[1].center.v })), 1.2);
LEVELS[0].stairs.forEach((s, i) => {
  const end = i === 0 ? TOWN_EDGE + 2 : TOWN_CORE + 4;
  road([pointAlong(s, STAIR_LEN), { u: s.axis.u * end, v: s.axis.v * end }], 1.6);
});
for (const s of LEVELS[1].stairs) {
  let b = pointAlong(s, STAIR_LEN);
  for (let k = 0; k < 40; k++) {
    b = pointAlong(s, STAIR_LEN + k * 0.5);
    if (Math.hypot(b.u, b.v) >= LEVELS[0].radius(Math.atan2(b.v, b.u)) - RING1_IN) break;
  }
  road([pointAlong(s, STAIR_LEN), b], 1.4);
}

export const townWalkways = {
  roads: townRoads,
  stairs: LEVELS.flatMap((lv) => lv.stairs.map((s) => ({ bottom: pointAlong(s, STAIR_LEN), top: pointAlong(s, -STAIR_LEN) }))),
  plaza: { center: LEVELS[1].center, radius: 7 },
  toDir: localToDir,
};

function roadGap(u, v) {
  let best = Infinity;
  for (const { a, b, half } of townRoads) {
    const abu = b.u - a.u;
    const abv = b.v - a.v;
    const t = THREE.MathUtils.clamp(((u - a.u) * abu + (v - a.v) * abv) / (abu * abu + abv * abv), 0, 1);
    best = Math.min(best, Math.hypot(u - a.u - abu * t, v - a.v - abv * t) - half);
  }
  return best;
}

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
};

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const WALL_STYLES = [
  { wall: M.plaster, frame: true },
  { wall: M.plasterWarm, frame: true },
  { wall: M.planks[0] },
  { wall: M.planks[1] },
  { wall: M.planks[2] },
  { wall: M.stoneWall },
];
const HOUSE_SIZES = [
  { w: 5, d: 4.5, h: 3 },
  { w: 6.5, d: 5, h: 3.2 },
  { w: 8, d: 5, h: 3 },
  { w: 5, d: 5, h: 4.8 },
];

const shop = (name, extra = {}) => ({ name, w: 6.5, d: 5, h: 3.6, door: 1.8, awning: true, inside: 'shop', wall: M.planks[2], ...extra });
const hotel = (name) => ({ name, w: 10, d: 6, h: 6.4, door: 2, balcony: true, inside: 'beds', wall: M.planks[0] });

// Every one of these gets built first; then the district fills up with MORE_SHOPS.
const SHOP_TYPES = [
  hotel('INN & HOTEL'),
  { name: 'HOSPITAL', w: 11, d: 6, h: 4.6, door: 2.2, inside: 'beds', wall: M.stoneWall },
  shop('GENERAL STORE', { w: 7.5, d: 5.5, h: 3.8, wall: M.plaster, frame: true, door: 2 }),
  { name: 'TAVERN', w: 9, d: 6, h: 4.2, door: 2, inside: 'tavern', wall: M.planks[1] },
  { name: 'BLACKSMITH', w: 7, d: 5.5, h: 3.6, door: 2.2, inside: 'forge', wall: M.stoneWall, chimney: true },
  shop('BAKERY', { wall: M.plasterWarm, frame: true, chimney: true }),
  shop('POST OFFICE', { wall: M.plaster, frame: true, awning: false }),
  shop('TAILOR'),
  { name: 'LIBRARY', w: 8, d: 5.5, h: 4.8, door: 2, inside: 'books', wall: M.stoneWall },
];
const MORE_SHOPS = [
  shop('GROCER', { wall: M.planks[1] }),
  hotel('HOTEL'),
  shop('POTION SHOP', { wall: M.plaster, frame: true }),
  { name: 'CLINIC', w: 8, d: 5.5, h: 3.8, door: 2, inside: 'beds', wall: M.stoneWall },
  shop('CARPENTER', { wall: M.planks[0], awning: false }),
  shop('BUTCHER', { wall: M.plasterWarm, frame: true }),
  shop('TOY SHOP', { wall: M.planks[2] }),
  { name: 'BOOK SHOP', w: 6.5, d: 5, h: 3.8, door: 1.8, inside: 'books', wall: M.plaster, frame: true },
  shop('FARM SUPPLY', { wall: M.planks[1], awning: false }),
  hotel('BOARDING HOUSE'),
];

function signMaterial(text, w, h, colors = {}) {
  if (typeof document === 'undefined') return M.signBoard;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * h) / w);
  const g = canvas.getContext('2d');
  g.fillStyle = colors.bg ?? '#5a3a22';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = colors.edge ?? '#2e1d10';
  g.lineWidth = 10;
  g.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  let size = Math.round(canvas.height * 0.55);
  const font = () => `bold ${size}px Georgia, 'Times New Roman', serif`;
  g.font = font();
  while (g.measureText(text).width > canvas.width - 50 && size > 12) {
    size -= 2;
    g.font = font();
  }
  g.fillStyle = colors.text ?? '#f1e2bf';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
}

function buildBuilding(rand, spec) {
  const style = spec.wall ? spec : pick(rand, WALL_STYLES);
  const roofMat = spec.roof ?? pick(rand, M.roofs);
  const { w, d } = spec;
  const wallH = spec.h;
  const g = new THREE.Group();
  const boxes = [];
  const T = 0.3;
  const BASE = spec.base ?? 0.25;
  const DOOR = spec.door ?? 1.6;
  const DOOR_H = spec.doorH ?? 2.6;
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
    part(box(bw, wallH - y0, bd), style.wall, x, BASE + (y0 + wallH) / 2, z);
    boxes.push({ x, z, hx: bw / 2, hz: bd / 2, y0: y0 === 0 ? -2 : BASE + y0, y1: top });
  };

  part(box(w + 0.5, BASE + 1, d + 0.5), M.stone, 0, (BASE - 1) / 2, 0);
  part(box(w - 2 * T, 0.06, d - 2 * T), M.floor, 0, BASE + 0.03, 0);
  boxes.push({ x: 0, z: 0, hx: w / 2 + 0.25, hz: d / 2 + 0.25, y0: -2, y1: BASE + 0.06 });

  const seg = (w - DOOR) / 2;
  wall(0, -d / 2 + T / 2, w, T);
  wall(-w / 2 + T / 2, 0, T, d - 2 * T);
  wall(w / 2 - T / 2, 0, T, d - 2 * T);
  wall(-w / 2 + seg / 2, d / 2 - T / 2, seg, T);
  wall(w / 2 - seg / 2, d / 2 - T / 2, seg, T);
  wall(0, d / 2 - T / 2, DOOR, T, DOOR_H);

  if (style.frame) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) part(box(0.4, wallH, 0.4), M.timber, sx * (w / 2 - 0.15), BASE + wallH / 2, sz * (d / 2 - 0.15));
      part(box(0.4, 0.3, d), M.timber, sx * (w / 2 - 0.15), top - 0.15, 0);
      part(box(0.22, DOOR_H, 0.42), M.timber, sx * (DOOR / 2 + 0.11), BASE + DOOR_H / 2, d / 2 - 0.15);
    }
    part(box(w + 0.1, 0.3, 0.4), M.timber, 0, top - 0.15, d / 2 - 0.15);
    part(box(w + 0.1, 0.3, 0.4), M.timber, 0, top - 0.15, -d / 2 + 0.15);
    part(box(DOOR + 0.44, 0.22, 0.42), M.timber, 0, BASE + DOOR_H + 0.11, d / 2 - 0.15);
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
    g.add(wg);
  };
  const windowRows = wallH >= 5 ? [BASE + 1.7, BASE + 4.4] : [BASE + 1.7];
  for (const y of windowRows) {
    windowAt(0, y, -d / 2 - 0.03, Math.PI);
    for (const sx of [-1, 1]) {
      windowAt(sx * (w / 2 + 0.03), y, 0, sx * (Math.PI / 2));
      if (w >= 9) windowAt(sx * (w / 4), y, -d / 2 - 0.03, Math.PI);
      if (d >= 6.5) windowAt(sx * (w / 2 + 0.03), y, -d / 4, sx * (Math.PI / 2));
    }
  }
  if (seg > 2.2) {
    for (const sx of [-1, 1]) windowAt(sx * (DOOR / 2 + seg / 2), BASE + 1.7, d / 2 + 0.03, 0);
  }
  if (wallH >= 5) {
    for (const sx of [-1, 1]) windowAt(sx * (w / 2 - 1.3), BASE + 4.4, d / 2 + 0.03, 0);
  }

  const over = 0.45;
  const halfSpan = d / 2 + over;
  const rh = 1.4 + d * 0.15;
  const angle = Math.atan2(rh, halfSpan);
  for (const s of [-1, 1]) {
    const slab = part(box(w + 2 * over, 0.2, Math.hypot(halfSpan, rh)), roofMat, 0, top + rh / 2 + 0.1, (s * halfSpan) / 2);
    slab.rotation.x = s * angle;
  }
  part(box(w + 2 * over + 0.2, 0.25, 0.3), M.timber, 0, top + rh + 0.15, 0);
  const gable = new THREE.ExtrudeGeometry(
    new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rh * 0.97)]),
    { depth: w, bevelEnabled: false },
  );
  gable.rotateY(Math.PI / 2);
  gable.translate(-w / 2, 0, 0);
  part(gable, style.wall, 0, top, 0);
  if (spec.chimney ?? (!spec.name && rand() < 0.4)) {
    part(box(0.7, rh + 1.4, 0.7), M.stone, w / 2 - 0.9, top + (rh + 1.4) / 2 - 0.2, -d / 4);
  }
  boxes.push({ x: 0, z: 0, hx: w / 2 + over, hz: d / 2 + over, y0: top, y1: top + rh * 0.55 });

  if (spec.name && spec.sign !== false) {
    const signH = Math.min(0.85, wallH - DOOR_H - 0.25);
    const signW = Math.min(w - 1.5, signH * 4.6);
    part(box(signW, signH, 0.1), signMaterial(spec.name, signW, signH), 0, BASE + DOOR_H + (wallH - DOOR_H) / 2, d / 2 + 0.06);
  }
  if (spec.awning && seg > 2.2) {
    const cloth = pick(rand, M.cloth);
    for (const sx of [-1, 1]) {
      const awning = part(box(1.7, 0.06, 1), cloth, sx * (DOOR / 2 + seg / 2), BASE + 2.4, d / 2 + 0.5);
      awning.rotation.x = 0.4;
    }
  }
  if (spec.balcony) {
    const y = BASE + 3.2;
    part(box(w - 0.6, 0.15, 1.3), M.wood, 0, y, d / 2 + 0.65);
    boxes.push({ x: 0, z: d / 2 + 0.65, hx: w / 2 - 0.3, hz: 0.65, y0: y - 0.1, y1: y + 0.08 });
    part(box(w - 0.6, 0.08, 0.08), M.woodDark, 0, y + 0.9, d / 2 + 1.25);
    for (let x = -w / 2 + 0.4; x <= w / 2 - 0.4; x += 0.8) part(box(0.08, 0.9, 0.08), M.woodDark, x, y + 0.45, d / 2 + 1.25);
    for (const sx of [-1, 1]) part(box(0.2, y, 0.2), M.woodDark, sx * (w / 2 - 0.5), y / 2, d / 2 + 1.2);
    part(box(1.2, 2.2, 0.06), M.window, 0, y + 1.2, d / 2 + 0.03);
  }

  const floorY = BASE + 0.06;
  const inside = {
    shop() {
      solid(box(Math.min(w * 0.5, 4), 1, 0.7), M.wood, 0, floorY + 0.5, -d / 2 + 1.6, floorY + 1);
      solid(box(w - 1, 2.2, 0.4), M.woodDark, 0, floorY + 1.1, -d / 2 + 0.55, floorY + 2.2);
      for (let x = -w / 2 + 1; x < w / 2 - 0.8; x += 0.7) {
        part(box(0.4, 0.35, 0.3), pick(rand, M.cloth), x, floorY + 1.3 + (rand() < 0.5 ? 0 : 0.6), -d / 2 + 0.75);
      }
    },
    beds() {
      for (const sx of [-1, 1]) {
        for (let z = -d / 2 + 1; z < d / 2 - 1.2; z += 1.4) {
          solid(box(1.9, 0.45, 1), M.wood, sx * (w / 2 - 1.3), floorY + 0.225, z, floorY + 0.55);
          part(box(1.5, 0.12, 0.9), M.linen, sx * (w / 2 - 1.4), floorY + 0.5, z);
          part(box(0.35, 0.15, 0.7), M.linen, sx * (w / 2 - 0.55), floorY + 0.55, z);
        }
      }
    },
    tavern() {
      solid(box(w * 0.6, 1.1, 0.7), M.woodDark, 0, floorY + 0.55, -d / 2 + 1.4, floorY + 1.1);
      for (const [x, z] of [[-w / 4, 0.3], [w / 4, 0.3], [-w / 4, -1.4], [w / 4, -1.4]]) {
        solid(box(1.4, 0.1, 1.4), M.wood, x, floorY + 0.85, z, floorY + 0.9);
        part(box(0.2, 0.8, 0.2), M.woodDark, x, floorY + 0.4, z);
      }
      for (let i = 0; i < 3; i++) part(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10), M.wood, -w / 2 + 0.8, floorY + 0.45, -d / 2 + 0.8 + i * 0.9);
    },
    forge() {
      solid(box(1.6, 1, 1.4), M.stone, -w / 2 + 1.3, floorY + 0.5, -d / 2 + 1.2, floorY + 1);
      part(box(1.2, 0.1, 1), M.flame, -w / 2 + 1.3, floorY + 1.02, -d / 2 + 1.2);
      solid(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 8), M.woodDark, 1, floorY + 0.25, -0.6, floorY + 0.75);
      part(box(0.9, 0.3, 0.4), M.iron, 1, floorY + 0.65, -0.6);
    },
    books() {
      for (const sx of [-1, 1]) {
        solid(box(0.5, 2.6, d - 1.6), M.woodDark, sx * (w / 2 - 0.6), floorY + 1.3, -0.2, floorY + 2.6);
        for (let y = 0.5; y < 2.5; y += 0.6) {
          part(box(0.1, 0.4, d - 1.8), pick(rand, M.cloth), sx * (w / 2 - 0.88), floorY + y, -0.2);
        }
      }
      solid(box(2, 0.1, 1), M.wood, 0, floorY + 0.85, -d / 2 + 1.5, floorY + 0.9);
    },
  };
  inside[spec.inside]?.();

  return { obj: g, boxes, part, solid, top, BASE };
}

const BANK_W = 13;
const BANK_D = 9;

function buildBank(rand) {
  const w = BANK_W;
  const d = BANK_D;
  const bank = buildBuilding(rand, {
    name: 'BANK', sign: false, w, d, h: 7, door: 2.8, doorH: 4, base: 0.75, wall: M.bankStone, roof: M.slate,
  });
  const { part, solid, boxes, top, BASE } = bank;
  const front = d / 2;

  solid(box(w + 0.5, BASE + 1, 2.6), M.bankStone, 0, (BASE - 1) / 2, front + 1.55, BASE);
  solid(box(w + 0.5, 1.5, 0.6), M.bankStone, 0, -0.25, front + 3.15, 0.5);
  solid(box(w + 0.5, 1.25, 0.6), M.bankStone, 0, -0.375, front + 3.75, 0.25);
  for (const x of [-5.7, -3.9, -2.1, 2.1, 3.9, 5.7]) {
    part(new THREE.CylinderGeometry(0.35, 0.38, 7, 12), M.bankStone, x, BASE + 3.5, front + 2.3);
    part(box(0.9, 0.3, 0.9), M.bankStone, x, BASE + 0.15, front + 2.3);
    part(box(0.9, 0.3, 0.9), M.bankStone, x, top - 0.15, front + 2.3);
    boxes.push({ x, z: front + 2.3, hx: 0.4, hz: 0.4, y0: -2, y1: top });
  }
  part(box(w + 0.5, 0.7, 2.9), M.bankStone, 0, top + 0.35, front + 1.3);
  boxes.push({ x: 0, z: front + 1.3, hx: w / 2 + 0.25, hz: 1.45, y0: top, y1: top + 0.7 });
  part(box(w + 0.7, 0.2, 0.2), M.gold, 0, top + 0.75, front + 2.75);
  const pediment = new THREE.ExtrudeGeometry(
    new THREE.Shape([new THREE.Vector2(-(w + 0.5) / 2, 0), new THREE.Vector2((w + 0.5) / 2, 0), new THREE.Vector2(0, 1.8)]),
    { depth: 0.5, bevelEnabled: false },
  );
  part(pediment, M.bankStone, 0, top + 0.7, front + 2.25);
  const emblem = part(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16), M.gold, 0, top + 1.35, front + 2.8);
  emblem.rotation.x = Math.PI / 2;
  part(box(4.8, 0.6, 0.1), signMaterial('BANK', 4.8, 0.6, { bg: '#3a3328', edge: '#e8c25a', text: '#e8c25a' }), 0, top + 0.35, front + 2.8);

  const floorY = BASE + 0.06;
  bank.lights = [];
  for (const x of [-w / 4, w / 4]) {
    part(box(0.06, 1.6, 0.06), M.iron, x, top - 0.8, -0.5);
    part(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 10), M.iron, x, top - 1.6, -0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(box(0.08, 0.22, 0.08), M.flame, x + Math.cos(a) * 0.8, top - 1.45, -0.5 + Math.sin(a) * 0.8);
    }
    bank.lights.push(new THREE.Vector3(x, top - 1.9, -0.5));
  }
  solid(box(w - 3.4, 1.2, 0.6), M.woodDark, 0, floorY + 0.6, 1.4, floorY + 1.2);
  for (let i = 0; i < 5; i++) part(box(0.08, 1.2, 0.08), M.gold, -w / 2 + 1.8 + (i * (w - 3.6)) / 4, floorY + 1.8, 1.4);

  // Three vault rooms of different sizes along the back wall, each full of coins.
  const back = -d / 2 + 0.3;
  const vaultRoom = (x0, x1, depth, fill) => {
    const cx = (x0 + x1) / 2;
    const width = x1 - x0;
    const wallH = 3.2;
    const T = 0.25;
    const doorW = 1.3;
    const frontZ = back + depth;
    const ironWall = (x, z, bw, bd) => solid(box(bw, wallH, bd), M.iron, x, floorY + wallH / 2, z, floorY + wallH);
    ironWall(x0 + T / 2, back + depth / 2, T, depth);
    ironWall(x1 - T / 2, back + depth / 2, T, depth);
    const seg = (width - doorW) / 2;
    ironWall(x0 + seg / 2, frontZ - T / 2, seg, T);
    ironWall(x1 - seg / 2, frontZ - T / 2, seg, T);
    part(box(doorW, wallH - 2.5, T), M.iron, cx, floorY + 2.5 + (wallH - 2.5) / 2, frontZ - T / 2);
    part(box(width + 0.1, 0.2, depth + 0.1), M.iron, cx, floorY + wallH + 0.1, back + depth / 2);
    boxes.push({ x: cx, z: back + depth / 2, hx: width / 2, hz: depth / 2, y0: floorY + 2.5, y1: floorY + wallH + 0.2 });
    for (const sx of [-1, 1]) part(box(0.12, 2.5, 0.12), M.gold, cx + sx * (doorW / 2 + 0.06), floorY + 1.25, frontZ + 0.02);

    const door = part(new THREE.CylinderGeometry(0.7, 0.7, 0.22, 18), M.iron, cx + doorW / 2 + 0.12, floorY + 1.2, frontZ + 0.75);
    door.rotation.z = Math.PI / 2;
    const wheel = part(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 8), M.gold, cx + doorW / 2 + 0.3, floorY + 1.2, frontZ + 0.75);
    wheel.rotation.z = Math.PI / 2;

    const spot = (marginX = 0.5, marginZ = 0.4) => ({
      x: x0 + T + marginX + rand() * (width - 2 * T - 2 * marginX),
      z: back + marginZ + rand() * (depth - T - 2 * marginZ - 0.6),
    });
    fill(spot, floorY);
  };

  const stack = (material, x, z, y, coins) => part(new THREE.CylinderGeometry(0.17, 0.17, coins * 0.06, 10), material, x, y + coins * 0.03, z);
  const heap = (material, x, z, y, radius, height) => part(new THREE.ConeGeometry(radius, height, 8), material, x, y + height / 2, z);
  const stacks = (spot, y, count, goldShare) => {
    for (let i = 0; i < count; i++) {
      const p = spot();
      stack(rand() < goldShare ? M.gold : M.silver, p.x, p.z, y, 4 + Math.floor(rand() * 10));
    }
  };
  const chest = (x, z, y) => {
    part(box(1, 0.6, 0.65), M.woodDark, x, y + 0.3, z);
    part(box(1.04, 0.08, 0.69), M.gold, x, y + 0.45, z);
    heap(M.gold, x, z, y + 0.6, 0.42, 0.3);
  };
  const bars = (x, z, y) => {
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 3 - layer; i++) {
        part(box(0.45, 0.15, 0.22), M.gold, x + (i - (2 - layer) / 2) * 0.48, y + 0.075 + layer * 0.15, z);
      }
    }
  };
  const sack = (x, z, y) => {
    const s = part(new THREE.IcosahedronGeometry(0.32, 0), M.sack, x, y + 0.28, z);
    s.scale.set(1, 0.9, 1);
    part(box(0.12, 0.12, 0.12), M.sack, x, y + 0.6, z);
  };

  vaultRoom(-w / 2 + 0.35, -3.6, 2.2, (spot, y) => {
    stacks(spot, y, 8, 0.2);
    const p = spot();
    sack(p.x, p.z, y);
  });
  vaultRoom(-3.4, 0.5, 2.9, (spot, y) => {
    heap(M.silver, -2.4, back + 0.9, y, 0.8, 0.55);
    stacks(spot, y, 10, 0.5);
    chest(-0.5, back + 0.6, y);
    const p = spot();
    sack(p.x, p.z, y);
  });
  vaultRoom(0.7, w / 2 - 0.35, 3.6, (spot, y) => {
    heap(M.gold, 3.6, back + 1.2, y, 1.2, 0.95);
    heap(M.silver, 1.6, back + 0.8, y, 0.7, 0.45);
    bars(5.2, back + 0.5, y);
    chest(1.8, back + 2.2, y);
    chest(5.3, back + 1.6, y);
    stacks(spot, y, 14, 0.7);
  });
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

function placeLocal(obj, u, v, fu, fv) {
  const dir = localToDir(u, v);
  return placeAt(obj, dir, towards(dir, localToDir(u + fu, v + fv)), RADIUS + groundAt(dir));
}

function addBoxesFrom(obj, boxes) {
  const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(obj.quaternion);
  const az = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
  const base = obj.position.length();
  for (const b of boxes) {
    addBox(obj.localToWorld(new THREE.Vector3(b.x, 0, b.z)), ax, az, b.hx, b.hz, base + b.y0, base + b.y1);
  }
}

function buildGround() {
  const step = 0.6;
  const n = Math.ceil((TOWN_EDGE + 1) / step);
  const size = 2 * n + 1;
  const points = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const dir = localToDir((i - n) * step, (j - n) * step);
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
    townGrass: new THREE.Color('#93a55a'),
  };

  function colorFor(a, b, c, u, v) {
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    mid.copy(a).add(b).add(c);
    const steep = e1.cross(e2).normalize().dot(mid.normalize()) < 0.8;
    const r = Math.hypot(u, v);
    if (steep) return color.copy(C.stone).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    const gap = roadGap(u, v);
    if (gap < 0) return color.copy(rand() < 0.3 ? C.dirtDark : C.dirt).offsetHSL(0, 0, (rand() - 0.5) * 0.04);
    if (r < 30 && levelAmount(LEVELS[1], u, v) > 0.98) {
      const odd = (Math.floor(u / 0.9) + Math.floor(v / 0.9)) & 1;
      return color.copy(odd ? C.cobble : C.cobbleDark).offsetHSL(0, 0, (rand() - 0.5) * 0.03);
    }
    color.copy(C.townGrass);
    const wild = THREE.MathUtils.smoothstep(r, TOWN_CORE - 4, TOWN_EDGE);
    if (wild > 0) color.lerp(grassColor(groundAt(mid), grass), wild);
    if (gap < 0.7) color.lerp(C.dirt, 0.45);
    return color.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
  }

  function tri(a, b, c, u, v) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    colorFor(a, b, c, u, v);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  }

  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      const u0 = (i - n) * step;
      const v0 = (j - n) * step;
      if (Math.hypot(u0 + step / 2, v0 + step / 2) > TOWN_EDGE + 0.5) continue;
      const a = points[i * size + j];
      const b = points[(i + 1) * size + j];
      const c = points[(i + 1) * size + j + 1];
      const d = points[i * size + j + 1];
      tri(a, b, c, u0 + step * 0.67, v0 + step * 0.33);
      tri(a, c, d, u0 + step * 0.33, v0 + step * 0.67);
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
  for (const lv of LEVELS) {
    for (const s of lv.stairs) {
      for (let i = 0; i < STEPS; i++) {
        const p = pointAlong(s, STAIR_LEN - (i + 0.5) * depth);
        const top = lv.low + (LEVEL_H * (i + 1)) / STEPS;
        const height = top - lv.low + 0.8;
        const step = new THREE.Group().add(mesh(box(STAIR_HALF * 2 + 0.3, height, depth + 0.02), M.stone, 0, top - height / 2, 0));
        const dir = localToDir(p.u, p.v);
        placeAt(step, dir, towards(dir, localToDir(p.u - s.axis.u, p.v - s.axis.v)), RADIUS);
        batch.add(step);
        addBoxesFrom(step, [{ x: 0, z: 0, hx: STAIR_HALF + 0.15, hz: depth / 2, y0: -10, y1: top }]);
      }
    }
  }
}

function buildFences(batch) {
  LEVELS.forEach((lv, li) => {
    const n = Math.round((2 * Math.PI * (li === 0 ? 27 : 11)) / 2.2);
    const posts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const r = lv.radius(t) - 1;
      const u = lv.center.u + r * Math.cos(t);
      const v = lv.center.v + r * Math.sin(t);
      posts.push(nearStairs(u, v, 1) ? null : { u, v });
    }
    posts.forEach((p, i) => {
      if (!p) return;
      batch.add(placeLocal(new THREE.Group().add(mesh(box(0.16, 1.1, 0.16), M.woodDark, 0, 0.55, 0)), p.u, p.v, 1, 0));
      const q = posts[(i + 1) % posts.length];
      if (!q) return;
      const len = Math.hypot(q.u - p.u, q.v - p.v);
      const rail = new THREE.Group().add(
        mesh(box(0.08, 0.1, len + 0.1), M.wood, 0, 0.85, 0),
        mesh(box(0.08, 0.1, len + 0.1), M.wood, 0, 0.45, 0),
      );
      batch.add(placeLocal(rail, (p.u + q.u) / 2, (p.v + q.v) / 2, (q.u - p.u) / len, (q.v - p.v) / len));
    });
  });
}

function buildLanterns(batch) {
  const rows = [
    { radius: () => RING0 - 2.3, spacing: 14, outward: 1 },
    { radius: (t) => LEVELS[0].radius(t) - RING1_IN + 1.9, spacing: 12, outward: -1 },
  ];
  for (const row of rows) {
    const n = Math.round((2 * Math.PI * row.radius(0)) / row.spacing);
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * Math.PI * 2;
      const r = row.radius(t);
      const u = r * Math.cos(t);
      const v = r * Math.sin(t);
      if (nearStairs(u, v, 1.5) || roadGap(u, v) < 0.2 || nearDoor(u, v)) continue;
      const lantern = placeLocal(makeLantern(), u, v, row.outward * Math.cos(t), row.outward * Math.sin(t));
      batch.add(lantern);
      addCollider(lantern.position.clone(), 0.25, 2.8);
    }
  }
}

const houseSpots = [];

function overlaps(a, b) {
  for (const [x, y] of [[a.fu, a.fv], [-a.fv, a.fu], [b.fu, b.fv], [-b.fv, b.fu]]) {
    const extent = (h) => Math.abs(h.fu * x + h.fv * y) * h.hd + Math.abs(-h.fv * x + h.fu * y) * h.hw;
    if (Math.abs((b.u - a.u) * x + (b.v - a.v) * y) > extent(a) + extent(b)) return false;
  }
  return true;
}

const footprint = (u, v, fu, fv, w, d) => ({ u, v, fu, fv, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });

function spotIsFree(u, v, fu, fv, w, d, level) {
  if (Math.hypot(u, v) + Math.hypot(w, d) / 2 > TOWN_CORE - 1) return false;
  const me = footprint(u, v, fu, fv, w, d);
  if (houseSpots.some((h) => overlaps(h, me))) return false;
  for (let sx = -0.5; sx <= 0.5; sx += 0.25) {
    for (let sz = -0.5; sz <= 0.5; sz += 0.25) {
      const pu = u - fv * sx * (w + 0.8) + fu * sz * (d + 0.8);
      const pv = v + fu * sx * (w + 0.8) + fv * sz * (d + 0.8);
      if (Math.abs(townHeight(pu, pv) - level) > 0.02) return false;
      if (roadGap(pu, pv) < 0.2 || nearStairs(pu, pv, 1)) return false;
    }
  }
  return true;
}

const nearDoor = (u, v) => houseSpots.some((h) => Math.hypot(u - h.u - h.fu * h.hd, v - h.v - h.fv * h.hd) < 2.2);

function placeProp(batch, rand, u, v, level) {
  if (Math.abs(townHeight(u, v) - level) > 0.02 || roadGap(u, v) < 0.3 || nearStairs(u, v, 1) || nearDoor(u, v)) return;
  const roll = rand();
  const { obj, r, top } = roll < 0.35 ? makeBarrel() : roll < 0.65 ? makeCrate(rand) : roll < 0.85 ? makeHay() : makeCart();
  const spin = rand() * Math.PI * 2;
  placeLocal(obj, u, v, Math.cos(spin), Math.sin(spin));
  batch.add(obj);
  addCollider(obj.position.clone(), r, top);
}

function tryHouse(batch, rand, u, v, fu, fv, spec, level) {
  const { w, d } = spec;
  if (!spotIsFree(u, v, fu, fv, w, d, level)) return false;
  const house = buildBuilding(rand, spec);
  if (spec.name) placedBuildings.push(spec.name);
  placeLocal(house.obj, u, v, fu, fv);
  batch.add(house.obj);
  addBoxesFrom(house.obj, house.boxes);
  houseSpots.push(footprint(u, v, fu, fv, w, d));

  if (rand() < 0.65) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (w / 2 + 0.9);
    const z = d / 2 - 0.7;
    placeProp(batch, rand, u - fv * x + fu * z, v + fu * x + fv * z, level);
  }
  return true;
}

export const placedBuildings = [];
const inShopDistrict = (t) => Math.abs(Math.atan2(Math.sin(t - SHIP_ANGLE), Math.cos(t - SHIP_ANGLE))) < 1.3;

function buildHouses(batch, rand) {
  const queue = [...SHOP_TYPES];
  let extra = 0;
  const choose = (district) => (district ? queue[0] ?? MORE_SHOPS[extra % MORE_SHOPS.length] : pick(rand, HOUSE_SIZES));
  const settle = (spec, placed) => {
    if (!spec.name) return;
    if (queue[0] !== spec) extra++;
    else if (placed) queue.shift();
    else queue.push(queue.shift());
  };

  const rows = [
    { radius: (d) => () => RING0 + 1.8 + SETBACK + d / 2, facing: -1, level: 0 },
    { radius: (d) => () => RING0 - 1.8 - SETBACK - d / 2, facing: 1, level: 0 },
    { radius: (d) => () => RING_OUT - 1.6 - SETBACK - d / 2, facing: 1, level: 0 },
    { radius: (d) => (t) => LEVELS[0].radius(t) - RING1_IN - 1.4 - SETBACK - d / 2, facing: 1, level: LEVEL_H },
  ];
  for (const row of rows) {
    let t = rand();
    while (t < Math.PI * 2 + 0.5) {
      const spec = choose(row.level === 0 && inShopDistrict(t));
      const r = row.radius(spec.d)(t);
      const placed = tryHouse(batch, rand, r * Math.cos(t), r * Math.sin(t), row.facing * Math.cos(t), row.facing * Math.sin(t), spec, row.level);
      settle(spec, placed);
      t += (placed ? spec.w + 2.5 : 1.5) / r;
    }
  }

  const c = LEVELS[1].center;
  for (let t = rand(); t < Math.PI * 2 + 0.5;) {
    const spec = pick(rand, HOUSE_SIZES);
    const r = LEVELS[1].radius(t) + LANE_OUT + 1.2 + SETBACK + spec.d / 2;
    const placed = tryHouse(batch, rand, c.u + r * Math.cos(t), c.v + r * Math.sin(t), -Math.cos(t), -Math.sin(t), spec, LEVEL_H);
    t += (placed ? spec.w + 2.5 : 1.5) / r;
  }

  LEVELS[0].stairs.forEach((s) => {
    const district = inShopDistrict(Math.atan2(s.axis.v, s.axis.u));
    for (let along = RING0 + 6; along < RING_OUT; along += 6) {
      for (const side of [-1, 1]) {
        const spec = choose(district);
        const off = 1.6 + SETBACK + spec.d / 2;
        const u = s.axis.u * along - side * s.axis.v * off;
        const v = s.axis.v * along + side * s.axis.u * off;
        settle(spec, tryHouse(batch, rand, u, v, side * s.axis.v, -side * s.axis.u, spec, 0));
      }
    }
  });
}

const lights = [];

function buildPlaza(batch, rand) {
  const c = LEVELS[1].center;
  const facing = SHIP_ANGLE + 0.4;
  const fu = Math.cos(facing);
  const fv = Math.sin(facing);
  const at = (angle, dist) => ({ u: c.u + Math.cos(angle) * dist, v: c.v + Math.sin(angle) * dist, fu: -Math.cos(angle), fv: -Math.sin(angle) });

  const bank = buildBank(rand);
  placeLocal(bank.obj, c.u - fu, c.v - fv, fu, fv);
  batch.add(bank.obj);
  addBoxesFrom(bank.obj, bank.boxes);
  for (const spot of bank.lights) {
    const light = new THREE.PointLight('#ffc477', 30, 16, 1.4);
    light.position.copy(bank.obj.localToWorld(spot.clone()));
    lights.push(light);
  }
  houseSpots.push(footprint(c.u + fu * 0.75, c.v + fv * 0.75, fu, fv, BANK_W + 0.5, BANK_D + 4));
  placedBuildings.push('BANK');

  const behind = at(facing + Math.PI, 8.6);
  const well = placeLocal(makeWell(), behind.u, behind.v, behind.fu, behind.fv);
  batch.add(well);
  addCollider(well.position.clone(), 1.3, 0.9);
  for (const a of [-1.68, 1.68]) {
    const spot = at(facing + a, 9.35);
    const stall = placeLocal(makeStall(rand), spot.u, spot.v, spot.fu, spot.fv);
    batch.add(stall);
    addBoxesFrom(stall, [{ x: 0, z: 0.4, hx: 1.2, hz: 0.4, y0: -2, y1: 0.9 }]);
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
  buildHouses(batch, rand);
  buildLanterns(batch);
  batch.build(town);
  lights.forEach((light) => town.add(light));
  return { houses: houseSpots.length };
}
