import * as THREE from 'three';
import { RADIUS, colliders } from './geo.js';
import { townLayout, buildingServices } from './town.js';

// The aliens' walking map: spots ("nodes") joined by straight walkable lines ("edges").
// Streets, the plaza, stairs, doorways and the spots inside every building are all on it.

const nodes = []; // { key, dir, height, links: [index] }
const byKey = new Map();

export const nav = {
  nodes,
  key: (k) => byKey.get(k),
  homes: [],
  plazaSpots: [],
  streetSpots: [],
};

function add(key, dir) {
  if (byKey.has(key)) return byKey.get(key);
  nodes.push({ key, dir: dir.clone().normalize(), height: 0, links: [] });
  byKey.set(key, nodes.length - 1);
  return nodes.length - 1;
}

function join(a, b) {
  const ia = typeof a === 'number' ? a : byKey.get(a);
  const ib = typeof b === 'number' ? b : byKey.get(b);
  if (ia === undefined || ib === undefined || ia === ib) return;
  if (!nodes[ia].links.includes(ib)) nodes[ia].links.push(ib);
  if (!nodes[ib].links.includes(ia)) nodes[ib].links.push(ia);
}

const distance = (a, b) => nodes[a].dir.angleTo(nodes[b].dir) * RADIUS;

function nearest(dir, keys, count = 1) {
  return keys
    .map((k) => ({ k, d: byKey.has(k) ? nodes[byKey.get(k)].dir.angleTo(dir) : Infinity }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((e) => e.k);
}

// A street that goes once around the town at distance `x` from the middle.
function ring(name, x, spacing) {
  const keys = [];
  const c = townLayout.cornerY(x);
  const n = Math.max(2, Math.round((2 * c) / spacing / 2) * 2);
  for (let axis = 0; axis < townLayout.axes; axis++) {
    for (let i = 0; i <= n; i++) {
      const y = -c + (i * 2 * c) / n;
      const key = `${name}${axis}_${i}`;
      add(key, townLayout.point(axis, x, y));
      if (i > 0) join(key, `${name}${axis}_${i - 1}`);
      keys.push(key);
    }
    if (axis > 0) join(`${name}${axis}_0`, `${name}${axis - 1}_${n}`);
  }
  join(`${name}0_0`, `${name}${townLayout.axes - 1}_${n}`);
  return { keys, middle: (axis) => `${name}${axis}_${n / 2}` };
}

// Where the ground is at this spot: the terrain, or a floor/step/porch standing on it.
function groundHeight(dir, heightAt) {
  const base = RADIUS + heightAt(dir);
  let best = base;
  const near = Math.cos(14 / RADIUS);
  const off = new THREE.Vector3();
  for (const c of colliders) {
    if (!c.box || c.off || c.dir.dot(dir) < near || c.top < base - 0.05 || c.top > base + 1.6) continue;
    off.copy(dir).multiplyScalar(c.top).sub(c.pos);
    off.addScaledVector(dir, -off.dot(dir));
    if (Math.abs(off.dot(c.ax)) < c.hx && Math.abs(off.dot(c.az)) < c.hz) best = Math.max(best, c.top);
  }
  return best - RADIUS;
}

export function buildNavigation(heightAt) {
  const L = townLayout;
  const inner = ring('in', L.innerStreet, 5);
  const outer = ring('out', L.outerStreet, 6);
  const plaza = ring('plaza', L.plazaRing, 5);
  nav.plazaSpots = plaza.keys;
  nav.streetSpots = [...inner.keys, ...outer.keys];

  for (let axis = 0; axis < L.axes; axis++) {
    add(`stairTop${axis}`, L.point(axis, L.stairTop));
    add(`stairBottom${axis}`, L.point(axis, L.stairBottom));
    join(`stairTop${axis}`, plaza.middle(axis));
    join(`stairTop${axis}`, `stairBottom${axis}`);
    join(`stairBottom${axis}`, inner.middle(axis));
    // Cross street from the inner street out to the back street.
    let previous = inner.middle(axis);
    for (let x = L.innerStreet + 5.4; x < L.outerStreet - 2; x += 5.4) {
      const key = `cross${axis}_${Math.round(x)}`;
      add(key, L.point(axis, x));
      join(previous, key);
      previous = key;
    }
    join(previous, outer.middle(axis));
    // Homes at the edge of town, past the back street.
    for (let y = -40; y <= 40; y += 5) {
      const key = `home${axis}_${y}`;
      add(key, L.point(axis, L.outerStreet + 8, y));
      for (const k of nearest(nav.nodes[byKey.get(key)].dir, outer.keys, 1)) join(key, k);
      nav.homes.push(key);
    }
  }

  // Every building: its own spots and links, with its front door joined to the street outside.
  for (const b of buildingServices) {
    b.navKey = (k) => `${b.name}:${k}`;
    for (const [k, dir] of Object.entries(b.nodes)) add(b.navKey(k), dir);
    for (const [a, c] of b.edges) join(b.navKey(a), b.navKey(c));
    const street = b.name === 'BANK' ? plaza.keys : inner.keys;
    for (const k of nearest(b.door.outside, street, 2)) join(b.navKey('outside'), k);
  }

  nodes.forEach((n) => {
    n.height = groundHeight(n.dir, heightAt);
  });
}

// Finds the shortest walk between two spots (A* search). Returns a list of node indexes.
export function findPath(from, to) {
  const start = typeof from === 'number' ? from : byKey.get(from);
  const goal = typeof to === 'number' ? to : byKey.get(to);
  if (start === undefined || goal === undefined) return [];
  const cost = new Map([[start, 0]]);
  const came = new Map();
  const open = new Set([start]);
  while (open.size) {
    let current = -1;
    let best = Infinity;
    for (const i of open) {
      const f = cost.get(i) + distance(i, goal);
      if (f < best) {
        best = f;
        current = i;
      }
    }
    if (current === goal) {
      const path = [goal];
      while (came.has(path[0])) path.unshift(came.get(path[0]));
      return path;
    }
    open.delete(current);
    for (const next of nodes[current].links) {
      const c = cost.get(current) + distance(current, next);
      if (c < (cost.get(next) ?? Infinity)) {
        cost.set(next, c);
        came.set(next, current);
        open.add(next);
      }
    }
  }
  return [];
}
