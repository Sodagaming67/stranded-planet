import * as THREE from 'three';

// Furniture and room layouts for building insides.
// Coordinates are inside one building: x goes across, z goes from the back wall (-) to the front door (+).

export const CEILING = 4.8;

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, seg = 10, rBottom = r) => new THREE.CylinderGeometry(r, rBottom, h, seg);

// ctx: { part, solid, rand, M, w, d, floorY, label }
export function furnish(kind, ctx) {
  ROOMS[kind]?.(ctx, toolkit(ctx));
}

// Things a shop can have on its shelves and tables. Each draws one item sitting on height y.
const ITEMS = {
  box: ({ part, M }, t, x, y, z) => part(box(0.32, 0.32, 0.32), t.pick(M.cloth), x, y + 0.16, z),
  bread: ({ part, M }, t, x, y, z) => part(box(0.42, 0.2, 0.24), M.bread, x, y + 0.1, z),
  pie: ({ part, M }, t, x, y, z) => {
    part(cyl(0.2, 0.1, 10), M.bread, x, y + 0.05, z);
    part(cyl(0.16, 0.03, 10), M.meat, x, y + 0.11, z);
  },
  potion: (ctx, t, x, y, z) => t.bottle(x, y, z),
  cloth: ({ part, M }, t, x, y, z) => {
    part(cyl(0.13, 0.5, 8), t.pick(M.cloth), x, y + 0.13, z).rotation.z = Math.PI / 2;
  },
  veg: ({ part, M }, t, x, y, z) => {
    for (const dx of [-0.1, 0.1]) part(new THREE.IcosahedronGeometry(0.11, 0), t.pick([M.leaf, ...M.cloth]), x + dx, y + 0.11, z);
  },
  meat: ({ part, M }, t, x, y, z) => part(new THREE.IcosahedronGeometry(0.18, 0), M.meat, x, y + 0.16, z).scale.set(1.3, 0.9, 1),
  cheese: ({ part, M }, t, x, y, z) => part(cyl(0.2, 0.14, 10), M.cheese, x, y + 0.07, z),
  candle: ({ part, M }, t, x, y, z) => {
    for (const dx of [-0.08, 0.08]) part(cyl(0.05, 0.3, 6), M.linen, x + dx, y + 0.15, z);
  },
  pot: ({ part, M }, t, x, y, z) => part(cyl(0.16, 0.3, 8, 0.11), M.pot, x, y + 0.15, z),
  book: ({ part, M }, t, x, y, z) => {
    for (const dx of [-0.1, 0, 0.1]) part(box(0.08, 0.32, 0.24), t.pick(M.cloth), x + dx, y + 0.16, z);
  },
  toy: ({ part, M }, t, x, y, z) => {
    if (t.pick([true, false])) part(new THREE.IcosahedronGeometry(0.14, 1), t.pick(M.cloth), x, y + 0.14, z);
    else part(box(0.22, 0.22, 0.22), t.pick(M.cloth), x, y + 0.11, z);
  },
  shoe: ({ part, M }, t, x, y, z) => {
    for (const dx of [-0.08, 0.08]) part(box(0.12, 0.1, 0.28), M.leather, x + dx, y + 0.05, z);
  },
  tool: ({ part, M }, t, x, y, z) => {
    part(box(0.05, 0.05, 0.5), M.woodDark, x, y + 0.03, z);
    part(box(0.22, 0.08, 0.08), M.iron, x, y + 0.07, z + 0.22);
  },
  sack: ({ part, M }, t, x, y, z) => part(new THREE.IcosahedronGeometry(0.18, 0), M.sack, x, y + 0.16, z),
  parcel: ({ part, M }, t, x, y, z) => {
    part(box(0.34, 0.24, 0.28), M.linen, x, y + 0.12, z);
    part(box(0.36, 0.26, 0.04), M.woodDark, x, y + 0.12, z);
  },
  herb: ({ part, M }, t, x, y, z) => part(new THREE.ConeGeometry(0.1, 0.32, 5), M.leaf, x, y + 0.16, z),
  plank: ({ part, M }, t, x, y, z) => part(box(0.6, 0.06, 0.15), M.wood, x, y + 0.03, z),
};

function toolkit(ctx) {
  const { part, solid, rand, M, floorY: f } = ctx;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const t = {
    pick,
    goods(x, y, z, kind) {
      const kinds = ctx.stock?.length ? ctx.stock : ['box'];
      ITEMS[kind ?? pick(kinds)](ctx, t, x, y, z);
    },
    // Walking spots inside the building, linked up so aliens can get around without walking through furniture.
    node(name, x, z) {
      ctx.nav.nodes[name] = [x, z];
      return name;
    },
    link(...names) {
      for (let i = 0; i < names.length - 1; i++) ctx.nav.edges.push([names[i], names[i + 1]]);
    },
    // Where a worker stands to serve, and where a customer stands to be served (both are walking spots).
    station(worker, customer) {
      ctx.stations.push({ worker, customer });
    },
    // A spot where someone doing a job here has a task (stocking a shelf, cleaning a room...).
    workSpot(node, label) {
      ctx.workSpots.push({ node, label });
    },
    X: ctx.w / 2 - 0.4,
    Z: ctx.d / 2 - 0.4,

    rug(x, z, w, d) {
      part(box(w, 0.03, d), pick(M.cloth), x, f + 0.015, z);
      part(box(Math.max(0.2, w - 0.5), 0.04, Math.max(0.2, d - 0.5)), pick(M.cloth), x, f + 0.02, z);
    },
    table(x, z, w = 1.6, d = 1, h = 0.9) {
      solid(box(w, 0.1, d), M.wood, x, f + h - 0.05, z, f + h);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) part(box(0.12, h - 0.1, 0.12), M.woodDark, x + sx * (w / 2 - 0.12), f + (h - 0.1) / 2, z + sz * (d / 2 - 0.12));
      }
      return f + h;
    },
    // A chair whose seat faces direction (fx, fz).
    chair(x, z, fx, fz) {
      part(box(0.55, 0.08, 0.55), M.wood, x, f + 0.5, z);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) part(box(0.07, 0.5, 0.07), M.woodDark, x + sx * 0.22, f + 0.25, z + sz * 0.22);
      }
      part(box(fz !== 0 ? 0.55 : 0.08, 0.65, fx !== 0 ? 0.55 : 0.08), M.wood, x - fx * 0.25, f + 0.85, z - fz * 0.25);
    },
    stool(x, z) {
      part(cyl(0.28, 0.6, 8), M.wood, x, f + 0.3, z);
    },
    candle(x, y, z) {
      part(cyl(0.06, 0.22, 6), M.linen, x, y + 0.11, z);
      part(box(0.06, 0.1, 0.06), M.flame, x, y + 0.27, z);
    },
    mug(x, y, z) {
      part(cyl(0.09, 0.18, 8), M.woodDark, x, y + 0.09, z);
    },
    bottle(x, y, z) {
      part(cyl(0.09, 0.3, 8), pick(M.cloth), x, y + 0.15, z);
      part(cyl(0.04, 0.1, 6), M.woodDark, x, y + 0.35, z);
    },
    lantern(x, z) {
      const top = f + CEILING;
      part(box(0.04, 0.8, 0.04), M.iron, x, top - 0.4, z);
      part(box(0.45, 0.08, 0.45), M.iron, x, top - 0.8, z);
      part(box(0.35, 0.42, 0.35), M.flame, x, top - 1.05, z);
    },
    plant(x, z) {
      part(cyl(0.32, 0.55, 8, 0.24), M.pot, x, f + 0.27, z);
      part(new THREE.IcosahedronGeometry(0.5, 0), M.leaf, x, f + 0.95, z);
      part(new THREE.IcosahedronGeometry(0.3, 0), M.leaf, x + 0.2, f + 1.35, z - 0.1);
    },
    barrel(x, z) {
      solid(cyl(0.42, 1, 10), M.wood, x, f + 0.5, z, f + 1);
      for (const y of [0.2, 0.8]) part(cyl(0.44, 0.08, 10), M.iron, x, f + y, z);
    },
    crate(x, z, s = 0.9) {
      solid(box(s, s, s), M.wood, x, f + s / 2, z, f + s);
    },
    // A painting on the back, left or right wall.
    painting(x, y, z, wall) {
      const flat = wall === 'back';
      part(box(flat ? 1.8 : 0.08, 1.3, flat ? 0.08 : 1.8), M.timber, x, y, z);
      const out = wall === 'left' ? 0.04 : wall === 'right' ? -0.04 : 0;
      part(box(flat ? 1.5 : 0.08, 1, flat ? 0.08 : 1.5), pick(M.cloth), x + out, y, z + (flat ? 0.04 : 0));
    },
    // A shelf unit stocked with goods on both faces.
    shelf(x, z, len, alongX, h = 2.4, kind = undefined) {
      solid(box(alongX ? len : 0.5, h, alongX ? 0.5 : len), M.woodDark, x, f + h / 2, z, f + h);
      for (let y = 0.45; y < h - 0.2; y += 0.6) {
        for (let s = -len / 2 + 0.35; s < len / 2 - 0.2; s += 0.5) {
          if (rand() < 0.3) continue;
          for (const side of [-1, 1]) {
            t.goods(alongX ? x + s : x + side * 0.32, f + y - 0.17, alongX ? z + side * 0.32 : z + s, kind);
          }
        }
      }
    },
    bed(x, z, alongX, headAt = -1) {
      const lw = alongX ? 2.2 : 1.2;
      const ld = alongX ? 1.2 : 2.2;
      solid(box(lw, 0.45, ld), M.wood, x, f + 0.225, z, f + 0.6);
      part(box(lw - 0.1, 0.14, ld - 0.1), M.linen, x, f + 0.52, z);
      const blanket = pick(M.cloth);
      if (alongX) {
        part(box(1.3, 0.16, 1.15), blanket, x - headAt * 0.4, f + 0.55, z);
        part(box(0.4, 0.16, 0.8), M.linen, x + headAt * 0.85, f + 0.62, z);
        part(box(0.12, 0.9, 1.2), M.woodDark, x + headAt * 1.1, f + 0.45, z);
      } else {
        part(box(1.15, 0.16, 1.3), blanket, x, f + 0.55, z - headAt * 0.4);
        part(box(0.8, 0.16, 0.4), M.linen, x, f + 0.62, z + headAt * 0.85);
        part(box(1.2, 0.9, 0.12), M.woodDark, x, f + 0.45, z + headAt * 1.1);
      }
    },
    nightstand(x, z) {
      solid(box(0.6, 0.6, 0.6), M.wood, x, f + 0.3, z, f + 0.6);
      t.candle(x, f + 0.6, z);
    },
    wardrobe(x, z, alongX) {
      solid(box(alongX ? 1.6 : 0.7, 2.4, alongX ? 0.7 : 1.6), M.woodDark, x, f + 1.2, z, f + 2.4);
    },
    bench(x, z, len, alongX) {
      solid(box(alongX ? len : 0.5, 0.1, alongX ? 0.5 : len), M.wood, x, f + 0.5, z, f + 0.55);
      for (const s of [-1, 1]) {
        part(box(alongX ? 0.1 : 0.45, 0.45, alongX ? 0.45 : 0.1), M.woodDark, alongX ? x + s * (len / 2 - 0.2) : x, f + 0.23, alongX ? z : z + s * (len / 2 - 0.2));
      }
    },
    fireplace(x, z, wall) {
      const flat = wall === 'back';
      const inward = wall === 'left' ? 1 : wall === 'right' ? -1 : 0;
      solid(box(flat ? 3 : 1, 2.4, flat ? 1 : 3), M.stone, x, f + 1.2, z, f + 2.4);
      part(box(flat ? 1.8 : 0.1, 1.2, flat ? 0.1 : 1.8), M.window, x + inward * 0.5, f + 0.75, z + (flat ? 0.5 : 0));
      part(box(flat ? 1.2 : 0.4, 0.4, flat ? 0.4 : 1.2), M.flame, x + inward * 0.35, f + 0.35, z + (flat ? 0.35 : 0));
      part(box(flat ? 3.4 : 1.3, 0.2, flat ? 1.3 : 3.4), M.wood, x + inward * 0.15, f + 2.5, z + (flat ? 0.15 : 0));
      part(box(flat ? 1.4 : 0.8, CEILING - 2.6, flat ? 0.8 : 1.4), M.stone, x - inward * 0.1, f + 2.6 + (CEILING - 2.6) / 2, z);
    },
    // An inside wall from `from` to `to` (along x at z = at, or along z at x = at), with doorways at `doors`.
    partition(axis, at, from, to, doors = [], doorW = 1.5) {
      const cuts = [from, ...doors.flatMap((p) => [p - doorW / 2, p + doorW / 2]), to];
      for (let i = 0; i < cuts.length; i += 2) {
        const a = cuts[i];
        const b = cuts[i + 1];
        if (b - a < 0.05) continue;
        const mid = (a + b) / 2;
        if (axis === 'x') solid(box(b - a, CEILING, 0.2), M.plaster, mid, f + CEILING / 2, at, f + CEILING);
        else solid(box(0.2, CEILING, b - a), M.plaster, at, f + CEILING / 2, mid, f + CEILING);
      }
      for (const p of doors) {
        if (axis === 'x') part(box(doorW + 0.3, 0.25, 0.3), M.timber, p, f + 2.7, at);
        else part(box(0.3, 0.25, doorW + 0.3), M.timber, at, f + 2.7, p);
      }
    },
    // One hotel bedroom between x0..x1 and z0..z1, with its door on the `doorSide` (+1 = front, -1 = back).
    bedroom(x0, x1, z0, z1, doorSide, number) {
      const cx = (x0 + x1) / 2;
      const far = doorSide > 0 ? z0 : z1;
      const near = doorSide > 0 ? z1 : z0;
      const inward = doorSide;
      t.bed(cx, far + inward * 1.4, false, -inward);
      t.nightstand(cx + 1.05, far + inward * 0.5);
      t.wardrobe(x1 - 0.55, far + inward * 1.2, false);
      t.table(x0 + 0.9, near - inward * 1.3, 1, 0.8, 0.8);
      t.chair(x0 + 0.9, near - inward * 0.6, 0, -inward);
      t.rug(cx, (far + near) / 2, Math.min(2.6, x1 - x0 - 1.4), 1.6);
      t.painting(cx, f + 2.2, far + inward * 0.08, 'back');
      if (ctx.label) part(box(0.6, 0.38, 0.06), ctx.label(String(number)), cx, f + 3.2, near + inward * 0.14);
      const door = t.node(`room${number}door`, cx, near + inward * 0.8);
      const center = t.node(`room${number}`, cx, (far + near) / 2);
      t.link(door, center);
      ctx.rooms.push({ number, center, door });
    },
  };
  return t;
}

const ROOMS = {
  shop({ w, d, floorY: f, M, part, solid }, t) {
    t.shelf(0, -t.Z + 0.3, w - 2.4, true, 3.4);
    for (const sx of [-1, 1]) t.shelf(sx * (t.X - 0.3), -2, d - 9, false, 3.4);
    const counter = Math.min(7, w * 0.35);
    solid(box(counter, 1.1, 0.9), M.wood, 0, f + 0.55, -t.Z + 3.3, f + 1.1);
    part(box(0.6, 0.35, 0.45), M.woodDark, -counter / 2 + 0.6, f + 1.27, -t.Z + 3.3);
    part(cyl(0.25, 0.04, 10), M.gold, counter / 2 - 1.2, f + 1.35, -t.Z + 3.3);
    part(box(0.05, 0.25, 0.05), M.gold, counter / 2 - 1.2, f + 1.22, -t.Z + 3.3);
    t.candle(counter / 2 - 0.5, f + 1.1, -t.Z + 3.3);
    for (let x = -counter / 2 + 1.4; x < counter / 2 - 1.6; x += 0.6) t.goods(x, f + 1.1, -t.Z + 3.3);
    const back = -t.Z;
    t.node('counterFront', 0, back + 4.4);
    t.node('counterSide', counter / 2 + 1.2, back + 4.4);
    t.node('counterBack', counter / 2 + 1.2, back + 2.3);
    t.node('clerk', 0, back + 2.3);
    t.link('inside', 'counterFront', 'counterSide', 'counterBack', 'clerk');
    t.station('clerk', 'counterFront');
    t.node('backShelfL', -w / 4, back + 1.4);
    t.node('backShelfR', w / 4, back + 1.4);
    t.link('clerk', 'backShelfL');
    t.link('counterBack', 'backShelfR');
    t.node('laneL', -(t.X - 1.2), back + 4.4);
    t.node('laneR', t.X - 1.2, back + 4.4);
    t.node('sideShelfL', -(t.X - 1.2), -2);
    t.node('sideShelfR', t.X - 1.2, -2);
    t.link('counterFront', 'laneL', 'sideShelfL');
    t.link('counterSide', 'laneR', 'sideShelfR');
    t.workSpot('backShelfL', 'Stock the back shelf (left)');
    t.workSpot('backShelfR', 'Stock the back shelf (right)');
    t.workSpot('sideShelfL', 'Stock the left wall shelf');
    t.workSpot('sideShelfR', 'Stock the right wall shelf');
    for (let x = -w / 2 + 4; x <= w / 2 - 4; x += 5) {
      if (Math.abs(x) < 2.5) continue;
      for (let z = -t.Z + 6.5; z < t.Z - 4; z += 4) {
        const top = t.table(x, z, 2.4, 1.4, 0.9);
        for (const dx of [-0.75, 0, 0.75]) {
          for (const dz of [-0.35, 0.35]) t.goods(x + dx, top, z + dz);
        }
      }
    }
    t.rug(0, t.Z - 2.2, 3.4, 2.4);
    for (const x of [-w / 4, w / 4]) for (const z of [-d / 5, d / 5]) t.lantern(x, z);
    for (const sx of [-1, 1]) {
      t.plant(sx * (t.X - 0.7), t.Z - 0.8);
      t.barrel(sx * (t.X - 0.8), -t.Z + 1.6);
      t.crate(sx * (t.X - 2), -t.Z + 1.5);
      t.painting(sx * t.X, f + 2.4, t.Z - 3, sx < 0 ? 'left' : 'right');
    }
  },

  hotel(ctx, t) {
    const { M, floorY: f, solid } = ctx;
    const { X, Z } = t;
    const corridor = 3;
    const backDepth = Math.max(4.5, (2 * Z - corridor) / 2);
    const zb = -Z + backDepth;
    const zf = zb + corridor;
    const lobbyHalf = Math.min(6, X * 0.4);
    let number = 1;

    const nBack = Math.max(2, Math.floor((2 * X) / 5));
    const roomW = (2 * X) / nBack;
    const backDoors = Array.from({ length: nBack }, (_, i) => -X + (i + 0.5) * roomW);
    t.partition('x', zb, -X, X, backDoors);
    for (let i = 1; i < nBack; i++) t.partition('z', -X + i * roomW, -Z, zb);
    for (let i = 0; i < nBack; i++) t.bedroom(-X + i * roomW, -X + (i + 1) * roomW, -Z, zb, 1, number++);

    if (Z - zf > 3.5) {
      for (const side of [-1, 1]) {
        const lo = side < 0 ? -X : lobbyHalf;
        const hi = side < 0 ? -lobbyHalf : X;
        const n = Math.max(1, Math.floor((hi - lo) / 4.5));
        const rw = (hi - lo) / n;
        t.partition('x', zf, lo, hi, Array.from({ length: n }, (_, i) => lo + (i + 0.5) * rw));
        t.partition('z', side * lobbyHalf, zf, Z);
        for (let i = 1; i < n; i++) t.partition('z', lo + i * rw, zf, Z);
        for (let i = 0; i < n; i++) t.bedroom(lo + i * rw, lo + (i + 1) * rw, zf, Z, -1, number++);
      }
    }

    // Hallway: a long rug runner and lanterns.
    t.rug(0, zb + corridor / 2, 2 * X - 1, 1.6);
    for (let x = -X + 3; x <= X - 3; x += 6) t.lantern(x, zb + corridor / 2);
    // Lobby: reception desk against the left wall (so the middle stays open), bench, plants.
    const deskZ = (zf + Z) / 2;
    const deskLen = Math.min(4, Z - zf - 1.5);
    const deskX = -lobbyHalf + 1.3;
    solid(box(0.8, 1.1, deskLen), M.woodDark, deskX, f + 0.55, deskZ, f + 1.1);
    ctx.part(cyl(0.12, 0.12, 8), M.gold, deskX, f + 1.16, deskZ + deskLen / 2 - 0.4);
    t.candle(deskX, f + 1.1, deskZ - deskLen / 2 + 0.4);
    t.node('hall', 0, zb + corridor / 2);
    t.node('deskFront', deskX + 1.3, deskZ);
    t.node('deskBack', -lobbyHalf + 0.5, zf + 0.4);
    t.node('clerk', -lobbyHalf + 0.5, deskZ);
    t.link('inside', 'hall', 'deskBack', 'clerk');
    t.link('inside', 'deskFront');
    t.station('clerk', 'deskFront');
    for (const room of ctx.rooms) {
      t.link('hall', room.door);
      t.workSpot(room.center, `Clean room ${room.number}`);
    }
    t.rug(1, deskZ, Math.min(4, lobbyHalf * 1.2), 2.6);
    t.bench(lobbyHalf - 0.6, deskZ, 2.4, false);
    for (const sx of [-1, 1]) t.plant(sx * (lobbyHalf - 0.7), Z - 0.8);
    t.lantern(0, deskZ);
  },

  hospital({ w, d, M, floorY: f, part }, t) {
    const { X, Z } = t;
    t.node('ward', 0, Z - 4.4);
    t.link('inside', 'ward');
    for (const sx of [-1, 1]) {
      for (let z = -Z + 1.2; z < Z - 4; z += 2.6) {
        t.bed(sx * (X - 1.15), z, true, sx);
        part(box(2.4, 2.2, 0.05), M.linen, sx * (X - 1.3), f + 1.5, z + 1.3);
        t.nightstand(sx * (X - 0.4), z + 0.95);
      }
    }
    if (X > 9) {
      part(box(0.2, 1.4, 2 * Z - 7), M.wood, 0, f + 0.7, -Z + 0.5 + (2 * Z - 7) / 2);
      for (const sx of [-1, 1]) {
        for (let z = -Z + 1.4; z < Z - 6.5; z += 2.6) t.bed(sx * 1.25, z, true, -sx);
      }
    }
    for (const sx of [-1, 1]) {
      const deskX = sx * (X / 2 + 1);
      const top = t.table(deskX, Z - 3, 1.8, 1, 0.85);
      const side = sx < 0 ? 'L' : 'R';
      t.node(`doctor${side}`, deskX, Z - 2.1);
      t.node(`patient${side}`, deskX, Z - 4.1);
      t.link('inside', `doctor${side}`);
      t.link('ward', `patient${side}`);
      t.station(`doctor${side}`, `patient${side}`);
      t.chair(deskX, Z - 2.1, 0, -1);
      t.candle(deskX - 0.5, top, Z - 3);
      t.shelf(sx * (X / 2 + 1), -Z + 0.3, 3, true, 2.2, 'potion');
      part(cyl(0.35, 0.9, 8), M.stoneWall, sx * (X / 2 + 3.2), f + 0.45, -Z + 0.6);
      part(cyl(0.45, 0.15, 10), M.linen, sx * (X / 2 + 3.2), f + 0.95, -Z + 0.6);
      t.plant(sx * (X - 0.7), Z - 0.8);
    }
    for (let x = -X + 3; x <= X - 3; x += 6) t.lantern(x, 0);
    t.rug(0, Z - 2, 3, 2.2);
  },

  tavern({ w, d, M, floorY: f, part, solid }, t) {
    const { X, Z } = t;
    const bar = w * 0.45;
    solid(box(bar, 1.2, 0.9), M.woodDark, 0, f + 0.6, -Z + 2.6, f + 1.2);
    for (let x = -bar / 2 + 0.5; x < bar / 2; x += 0.9) t.mug(x, f + 1.2, -Z + 2.6);
    for (let x = -bar / 2; x <= bar / 2; x += 1.1) {
      const keg = part(cyl(0.42, 0.9, 10), M.wood, x, f + 0.45, -Z + 0.6);
      keg.rotation.x = Math.PI / 2;
      t.stool(x, -Z + 3.6);
    }
    t.shelf(0, -Z + 0.25, bar, true, 3, 'potion');
    t.node('aisle', 0, -Z + 4.8);
    t.node('barSide', bar / 2 + 1, -Z + 4.8);
    t.node('barBack', bar / 2 + 1, -Z + 1.6);
    t.link('inside', 'aisle', 'barSide', 'barBack');
    [-bar / 4, bar / 4].forEach((x, i) => {
      t.node(`keeper${i}`, x, -Z + 1.6);
      t.node(`guest${i}`, x + 0.55, -Z + 4.2);
      t.link('barBack', `keeper${i}`);
      t.link('aisle', `guest${i}`);
      t.station(`keeper${i}`, `guest${i}`);
    });
    t.fireplace(-X + 0.5, -1, 'left');
    t.rug(-X + 2.8, -1, 2.4, 3.4);
    for (let x = -X + 5; x <= X - 3; x += 4.5) {
      if (Math.abs(x) < 2.5) continue;
      for (let z = -Z + 6; z < Z - 3.5; z += 4) {
        const top = t.table(x, z, 1.6, 1.6, 0.9);
        t.candle(x, top, z);
        t.mug(x + 0.4, top, z + 0.3);
        t.mug(x - 0.4, top, z - 0.3);
        for (const [sx, sz] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2]]) t.stool(x + sx, z + sz);
      }
    }
    t.bench(X - 0.5, 0, Math.min(8, 2 * Z - 6), false);
    for (let x = -X + 3; x <= X - 3; x += 5) t.lantern(x, 0);
    for (const sx of [-1, 1]) {
      t.barrel(sx * (X - 0.8), Z - 1);
      t.barrel(sx * (X - 1.8), Z - 1);
      t.painting(sx * 4, f + 3.4, -Z + 0.08, 'back');
    }
  },

  forge({ w, d, M, floorY: f, part, solid }, t) {
    const { X, Z } = t;
    for (const x of [-w / 4, w / 4]) {
      solid(box(3.2, 1.3, 2.4), M.stone, x, f + 0.65, -Z + 1.4, f + 1.3);
      part(box(2.6, 0.12, 1.9), M.flame, x, f + 1.34, -Z + 1.4);
      part(box(2.8, 1.6, 2), M.stone, x, f + CEILING - 1, -Z + 1.2);
      solid(box(1, 0.9, 1), M.wood, x + 2.3, f + 0.45, -Z + 1.4, f + 0.9);
      part(box(0.9, 0.3, 0.9), M.linen, x + 2.3, f + 1.05, -Z + 1.4);
    }
    for (let x = -X + 3.5; x <= X - 3.5; x += 5) {
      if (Math.abs(x) < 2.5) continue;
      for (let z = -Z + 5.5; z < Z - 4; z += 4.5) {
        solid(cyl(0.4, 0.55, 8, 0.45), M.woodDark, x, f + 0.27, z, f + 0.85);
        part(box(1, 0.3, 0.45), M.iron, x, f + 0.7, z);
        part(box(0.12, 0.12, 0.6), M.woodDark, x + 0.3, f + 0.92, z + 0.2);
        part(box(0.25, 0.18, 0.18), M.iron, x + 0.3, f + 0.95, z + 0.5);
      }
    }
    // Weapon rack and tool wall.
    part(box(0.2, 0.15, 6), M.woodDark, X - 0.2, f + 2.2, 0);
    for (let z = -2.6; z <= 2.6; z += 0.65) {
      part(box(0.06, 1.6, 0.14), M.iron, X - 0.35, f + 1.6, z);
      part(box(0.1, 0.1, 0.4), M.gold, X - 0.35, f + 2.4, z);
    }
    for (let z = -2.5; z <= 2.5; z += 0.8) {
      part(box(0.1, 0.7, 0.08), M.woodDark, -X + 0.25, f + 2.2, z);
      part(box(0.18, 0.2, 0.3), M.iron, -X + 0.25, f + 2.6, z);
    }
    solid(box(2.4, 0.7, 0.9), M.wood, -X + 1.2, f + 0.35, Z - 4, f + 0.7);
    part(box(2.2, 0.05, 0.7), M.water, -X + 1.2, f + 0.66, Z - 4);
    part(new THREE.ConeGeometry(1, 0.7, 7), M.iron, X - 1.4, f + 0.35, -Z + 1.4);
    for (const z of [Z - 1, Z - 2.1]) t.crate(X - 0.8, z);
    const sale = t.table(X / 2, Z - 3.5, 2.4, 1.2, 0.9);
    for (const dx of [-0.8, 0, 0.8]) t.goods(X / 2 + dx, sale, Z - 3.5, 'tool');
    t.node('counter', X / 2, Z - 2.5);
    t.node('smithSide', X / 2 + 1.8, Z - 2.5);
    t.node('smithBack', X / 2 + 1.8, Z - 4.5);
    t.node('smith', X / 2, Z - 4.5);
    t.link('inside', 'counter', 'smithSide', 'smithBack', 'smith');
    t.station('smith', 'counter');
    for (let x = -X + 3; x <= X - 3; x += 6) t.lantern(x, 0);
  },

  books({ w, d, M, floorY: f, part }, t) {
    const { X, Z } = t;
    const len = d * 0.5;
    const shelves = [];
    for (let x = -X + 1.8; x <= X - 1.8; x += 3) {
      if (Math.abs(x) < 2.5) continue;
      t.shelf(x, -Z + 0.6 + len / 2, len, false, 3.6, 'book');
      shelves.push(x);
    }
    t.node('stacks', 0, -Z + 0.6 + len + 1.2);
    t.link('inside', 'stacks');
    for (let i = 0; i < shelves.length - 1; i++) {
      if (shelves[i + 1] - shelves[i] > 3.5) continue;
      const ax = (shelves[i] + shelves[i + 1]) / 2;
      t.node(`aisleEnd${i}`, ax, -Z + 0.6 + len + 1.2);
      t.node(`aisle${i}`, ax, -Z + 0.6 + len / 2);
      t.link('stacks', `aisleEnd${i}`, `aisle${i}`);
      t.workSpot(`aisle${i}`, 'Put books back on a shelf');
    }
    part(box(0.1, 3.4, 0.6), M.wood, -X + 4.6, f + 1.7, -Z + 4);
    for (const sx of [-1, 1]) {
      const tx = sx * (X / 2);
      const top = t.table(tx, Z - 4, 3, 1.4, 0.9);
      t.candle(tx - 0.8, top, Z - 4);
      t.candle(tx + 0.8, top, Z - 4);
      for (const dx of [-0.8, 0.8]) {
        t.chair(tx + dx, Z - 4.9, 0, 1);
        t.chair(tx + dx, Z - 3.1, 0, -1);
      }
      t.rug(tx, Z - 4, 4.4, 3.4);
      t.plant(sx * (X - 0.7), Z - 0.8);
    }
    part(cyl(0.08, 1, 6), M.woodDark, 2.2, f + 0.5, Z - 1.6);
    part(new THREE.IcosahedronGeometry(0.45, 1), M.water, 2.2, f + 1.3, Z - 1.6);
    const deskTop = t.table(-2.4, Z - 1.6, 1.6, 0.9, 1);
    t.candle(-2.4, deskTop, Z - 1.6);
    t.goods(-2.0, deskTop, Z - 1.6, 'book');
    t.node('librarian', -2.4, Z - 2.4);
    t.node('entry', 0, Z - 0.9);
    t.node('reader', -2.4, Z - 0.6);
    t.link('inside', 'librarian');
    t.link('inside', 'entry', 'reader');
    t.station('librarian', 'reader');
    for (let x = -X + 3; x <= X - 3; x += 6) t.lantern(x, -1);
  },

  stable({ w, d, M, floorY: f, part, solid }, t) {
    const { X, Z } = t;
    const stalls = Math.max(2, Math.floor((2 * X) / 3.5));
    const sw = (2 * X) / stalls;
    for (let i = 0; i <= stalls; i++) {
      const x = -X + i * sw;
      solid(box(0.15, 1.4, 4), M.woodDark, x, f + 0.7, -Z + 2, f + 1.4);
    }
    for (let i = 0; i < stalls; i++) {
      const x = -X + (i + 0.5) * sw;
      part(new THREE.ConeGeometry(0.9, 0.6, 7), M.hay, x, f + 0.3, -Z + 1.2);
      solid(box(1.4, 0.5, 0.5), M.wood, x, f + 0.25, -Z + 3.4, f + 0.5);
      part(box(1.2, 0.05, 0.35), M.water, x, f + 0.5, -Z + 3.4);
    }
    part(box(0.2, 0.2, 3), M.woodDark, X - 0.3, f + 1.4, Z - 4);
    for (const z of [Z - 3.2, Z - 4.8]) part(box(0.5, 0.4, 0.8), M.woodDark, X - 0.45, f + 1.55, z);
    for (const z of [Z - 1.5, Z - 3]) part(box(1.3, 0.75, 0.85), M.hay, -X + 1, f + 0.38, z);
    t.lantern(0, 0);
    t.node('hand', 0, -Z + 4.6);
    t.node('rider', 0, Z - 3);
    t.link('inside', 'hand');
    t.link('inside', 'rider');
    t.station('hand', 'rider');
  },

  bankLobby({ w, d, M, floorY: f, part }, t) {
    const { X, Z } = t;
    t.node('lobby', 0, 2.8);
    t.link('inside', 'lobby');
    for (const sx of [-1, 1]) {
      t.node(`tellerLane${sx}`, sx * 17.5, 2.8);
      t.node(`tellerBack${sx}`, sx * 17.5, 0.6);
      t.link('lobby', `tellerLane${sx}`, `tellerBack${sx}`);
    }
    for (const x of [-12, -6, 0, 6, 12]) {
      t.node(`teller${x}`, x, 0.6);
      t.node(`client${x}`, x, 2.8);
      t.link('lobby', `client${x}`);
      t.link(`tellerBack${x <= 0 ? -1 : 1}`, `teller${x}`);
      t.station(`teller${x}`, `client${x}`);
    }
    part(box(3.4, 0.04, Z - 2.4), M.carpet, 0, f + 0.02, (Z + 2.4) / 2);
    for (const sx of [-1, 1]) {
      for (let z = 3.5; z < Z - 2; z += 3.5) t.bench(sx * (X - 0.6), z, 2.6, false);
      for (const z of [4, 9]) {
        const dx = sx * (X / 2);
        const top = t.table(dx, z, 2, 1, 0.85);
        t.chair(dx, z - 0.9, 0, 1);
        part(box(0.5, 0.02, 0.7), M.linen, dx - 0.3, top + 0.01, z);
        t.candle(dx + 0.6, top, z);
      }
      for (const z of [3.2, Z - 1]) {
        part(cyl(0.08, 1, 8), M.gold, sx * 2.2, f + 0.5, z);
        part(new THREE.IcosahedronGeometry(0.14, 0), M.gold, sx * 2.2, f + 1.05, z);
      }
      t.plant(sx * (X - 0.8), Z - 0.9);
      t.plant(sx * (X - 0.8), 2.8);
      for (const z of [5, 10]) t.painting(sx * X, f + 3.4, z, sx < 0 ? 'left' : 'right');
    }
    part(box(0.08, 0.08, Z - 4.4), M.carpet, 2.2, f + 0.9, (Z + 2.2) / 2);
    part(box(0.08, 0.08, Z - 4.4), M.carpet, -2.2, f + 0.9, (Z + 2.2) / 2);
  },
};
