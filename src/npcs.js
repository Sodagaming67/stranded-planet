import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RADIUS, makeRandom } from './geo.js';
import { clock } from './clock.js';
import { SERVICES } from './services.js';
import { buildingServices } from './town.js';
import { nav, findPath } from './navigation.js';
import { JOBS } from './jobs.js';

// The aliens who live in town. Every alien follows the same plan every day:
// workers walk to work, serve customers, relax, and go home to sleep; citizens run errands;
// helpers do the same jobs the player can do.

export const npcs = [];
const WALK_SPEED = 3.6;
const COMMUTE = 80; // workers leave home this many minutes before their shift
const CITIZENS = 14;

const NAMES = [
  'Zib', 'Pom', 'Vex', 'Quill', 'Lumi', 'Bix', 'Tova', 'Grub', 'Nim', 'Orla', 'Pip', 'Rook', 'Suki', 'Trix', 'Ulo', 'Wix',
  'Yara', 'Zorp', 'Blim', 'Crix', 'Dax', 'Fizz', 'Gloop', 'Hux', 'Ixa', 'Jorb', 'Kip', 'Lark', 'Moxi', 'Nuzz', 'Oob',
  'Plix', 'Quor', 'Ree', 'Skee', 'Tib', 'Vim', 'Wump', 'Xel', 'Yib', 'Zuzu', 'Bop', 'Cree', 'Dob',
];
const SKINS = ['#7bd389', '#8ecae6', '#c77dff', '#f4a261', '#ff8fab', '#90be6d', '#ffd166', '#6ad5c9', '#b8f2e6'];
const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#8338ec', '#3a86ff', '#ff006e', '#6a994e', '#bc6c25'];
const OUTFITS = {
  Baker: { shirt: '#f4f1e8', hat: 'chef', apron: '#ffffff' },
  Doctor: { shirt: '#ffffff', coat: true },
  Nurse: { shirt: '#ffffff', coat: true },
  'Bank teller': { shirt: '#d4a017', hat: 'cap', hatColor: '#3a3328' },
  Innkeeper: { shirt: '#b5523b', hat: 'cap', hatColor: '#5a3a22' },
  Landlord: { shirt: '#b5523b' },
  Postmaster: { shirt: '#3a5a98', hat: 'cap', hatColor: '#23395d' },
  Courier: { shirt: '#3a5a98', hat: 'cap', hatColor: '#23395d', bag: true },
  Blacksmith: { shirt: '#4a4a4a', apron: '#3b2a1d' },
  Librarian: { shirt: '#6b4c8a', glasses: true },
  'Book sorter': { shirt: '#6b4c8a', glasses: true },
  'Tavern keeper': { shirt: '#6a994e', apron: '#f4f1e8' },
  'Room cleaner': { shirt: '#9ad1d4', apron: '#ffffff', hat: 'scarf', hatColor: '#e76f51' },
  'Bread runner': { shirt: '#f4f1e8', apron: '#c68b4e', bag: true },
  'Shelf stocker': { shirt: '#2a9d8f', apron: '#8a6239' },
  Storekeeper: { shirt: '#2a9d8f', apron: '#8a6239' },
};

const TIPS = [
  'The hotel charges for your room every night at 9 PM. Keep some silver handy!',
  'The bank vaults are always locked. Only the bank aliens can open them.',
  'Managers will pay you for work. Ask the postmaster, the baker, the innkeeper, the storekeeper or the librarian!',
  'You need a library card before you can borrow a book.',
  'Food from the bakery is tasty AND it gives you back some health.',
  'Most shops open at 8 AM and close at 8 PM. The bank opens at 9.',
  'When the sun goes down, the windows in town light up. It is my favorite time of day.',
  'Press B to look in your bag.',
];

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const minutes = (hours) => Math.round(hours * 60);
const timeText = (m) => {
  const h = Math.floor(((m + 1440) % 1440) / 60);
  const mm = Math.floor((m + 1440) % 60);
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// ---------- How an alien looks ----------

const alienMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });

function colored(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) c.toArray(colors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function buildAlien(rand, role, citizen) {
  const skin = pick(rand, SKINS);
  const outfit = OUTFITS[role] ?? (citizen
    ? { shirt: pick(rand, SHIRTS), scarf: rand() < 0.5 ? pick(rand, SHIRTS) : null }
    : { shirt: pick(rand, SHIRTS), apron: pick(rand, ['#8a6239', '#f4f1e8', '#b5523b']) });
  const parts = [
    colored(0.78, 0.8, 0.5, 0, 1.1, 0, outfit.shirt),
    colored(0.86, 0.72, 0.76, 0, 1.86, 0, skin),
    colored(0.22, 0.05, 0.03, 0, 1.68, 0.39, '#3b1f2b'),
  ];
  for (const s of [-1, 1]) {
    parts.push(
      colored(0.2, 0.62, 0.22, s * 0.5, 1.12, 0, outfit.coat ? '#ffffff' : outfit.shirt),
      colored(0.18, 0.16, 0.2, s * 0.5, 0.74, 0, skin),
      colored(0.2, 0.24, 0.04, s * 0.19, 1.92, 0.39, '#111111'),
      colored(0.07, 0.07, 0.02, s * 0.15, 1.98, 0.415, '#ffffff'),
      colored(0.05, 0.36, 0.05, s * 0.22, 2.38, 0, skin),
      colored(0.13, 0.13, 0.13, s * 0.22, 2.6, 0, pick(rand, SHIRTS)),
    );
  }
  if (outfit.apron) parts.push(colored(0.6, 0.75, 0.04, 0, 0.98, 0.27, outfit.apron));
  if (outfit.coat) parts.push(colored(0.84, 0.95, 0.55, 0, 1.03, 0, '#ffffff'), colored(0.16, 0.16, 0.02, 0.2, 1.3, 0.285, '#d62839'));
  if (outfit.hat === 'chef') parts.push(colored(0.62, 0.45, 0.62, 0, 2.43, 0, '#ffffff'));
  if (outfit.hat === 'cap') parts.push(colored(0.9, 0.14, 0.8, 0, 2.28, 0, outfit.hatColor), colored(0.5, 0.05, 0.3, 0, 2.23, 0.5, outfit.hatColor));
  if (outfit.hat === 'scarf') parts.push(colored(0.9, 0.2, 0.8, 0, 2.22, 0, outfit.hatColor));
  if (outfit.glasses) parts.push(colored(0.64, 0.06, 0.03, 0, 1.95, 0.42, '#222222'));
  if (outfit.bag) parts.push(colored(0.22, 0.4, 0.38, 0.52, 0.95, 0, '#8a6239'), colored(0.84, 0.06, 0.06, 0.05, 1.3, 0.26, '#5e4128'));
  if (outfit.scarf) parts.push(colored(0.82, 0.14, 0.56, 0, 1.47, 0, outfit.scarf));

  const group = new THREE.Group();
  const body = new THREE.Mesh(mergeGeometries(parts), alienMat);
  body.castShadow = true;
  group.add(body);
  const pants = pick(rand, ['#3d405b', '#5e4128', '#264653', '#4a4a4a']);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.18, 0.7, 0);
    const leg = new THREE.Mesh(colored(0.28, 0.7, 0.3, 0, -0.35, 0, pants), alienMat);
    leg.castShadow = true;
    pivot.add(leg);
    group.add(pivot);
    return pivot;
  });
  group.scale.setScalar(0.85 + rand() * 0.3);
  return { group, legs };
}

// ---------- Daily plans ----------

const stop = (at, place, kind, label) => ({ at: ((Math.round(at) % 1440) + 1440) % 1440, place, kind, label });
const byName = (name) => buildingServices.find((b) => b.name === name);

function shiftFor(building, index, stations) {
  const [open, close] = SERVICES[building].hours;
  if (close - open < 24) return [minutes(open), minutes(Math.min(close, 23.5))];
  if (stations === 1) return [minutes(6), minutes(23)];
  return index % 2 === 0 ? [minutes(6), minutes(18)] : [minutes(14), minutes(23.5)];
}

function eveningSpot(rand) {
  const tavern = byName('TAVERN');
  if (tavern && rand() < 0.6) return { place: tavern.navKey(pick(rand, tavern.stations).customerNode), label: 'relaxing at the tavern' };
  return { place: pick(rand, nav.plazaSpots), label: 'hanging out on the bank plaza' };
}

function workerPlan(rand, b, station, index, home) {
  const [start, end] = shiftFor(b.name, index, b.stations.length);
  const stops = [stop(start - COMMUTE, b.navKey(station.workerNode), 'work', `working at the ${b.name.toLowerCase()}`)];
  if (end < minutes(22)) {
    const evening = eveningSpot(rand);
    stops.push(stop(end, evening.place, 'visit', evening.label));
    stops.push(stop(end + 90, home, 'sleep', 'at home, asleep'));
  } else {
    stops.push(stop(end, home, 'sleep', 'at home, asleep'));
  }
  return stops;
}

function helperPlan(rand, b, info, home) {
  const [open, close] = SERVICES[b.name].hours;
  const start = minutes(Math.max(open, 8));
  const end = minutes(Math.min(close, 18));
  const stops = [];
  let t = start - 45;
  let goOut = true;
  while (t < end) {
    let place;
    let label;
    if (info.kind === 'deliver') {
      const targets = buildingServices.filter((o) => o.name !== b.name && (!info.to || info.to.includes(o.name)));
      if (goOut && targets.length) {
        const to = pick(rand, targets);
        place = to.navKey('outside');
        label = `${info.task.toLowerCase()} ${to.name.toLowerCase()}`;
      } else {
        place = b.navKey('inside');
        label = `picking up more at the ${b.name.toLowerCase()}`;
      }
      goOut = !goOut;
    } else if (info.kind === 'rooms') {
      const room = pick(rand, b.rooms);
      place = b.navKey(room.node);
      label = `cleaning room ${room.number} at the ${b.name.toLowerCase()}`;
    } else {
      const spot = pick(rand, b.workSpots);
      place = b.navKey(spot.node);
      label = `working at the ${b.name.toLowerCase()}: ${spot.label.toLowerCase()}`;
    }
    stops.push(stop(t, place, 'task', label));
    t += 25 + rand() * 15;
  }
  const evening = eveningSpot(rand);
  stops.push(stop(end, evening.place, 'visit', evening.label));
  stops.push(stop(end + 80, home, 'sleep', 'at home, asleep'));
  return stops;
}

function citizenPlan(rand, home) {
  const stops = [];
  let t = minutes(7) + rand() * 90;
  const bedtime = minutes(20) + rand() * 70;
  while (t < bedtime) {
    const hour = t / 60;
    const choices = [];
    for (const b of buildingServices) {
      if (!b.stations.length) continue;
      const [open, close] = b.hours;
      if (hour >= open && hour + 1 < close) {
        choices.push({ place: b.navKey(pick(rand, b.stations).customerNode), label: `visiting the ${b.name.toLowerCase()}` });
      }
    }
    choices.push({ place: pick(rand, nav.plazaSpots), label: 'walking around the bank plaza' });
    choices.push({ place: pick(rand, nav.streetSpots), label: 'taking a walk around town' });
    if (hour >= 17) {
      const tavern = byName('TAVERN');
      if (tavern) choices.push({ place: tavern.navKey(pick(rand, tavern.stations).customerNode), label: 'having dinner at the tavern' });
    }
    const errand = pick(rand, choices);
    stops.push(stop(t, errand.place, 'visit', errand.label));
    t += 50 + rand() * 60;
  }
  stops.push(stop(t, home, 'sleep', 'at home, asleep'));
  return stops;
}

// ---------- Creating the aliens ----------

export function createNPCs(scene) {
  const rand = makeRandom(4242);
  const names = [...NAMES];
  const takeName = () => names.splice(Math.floor(rand() * names.length), 1)[0] ?? `Alien ${npcs.length + 1}`;
  const homes = [...nav.homes];
  // Workers live close to where they work; citizens live anywhere.
  const takeHome = (near) => {
    if (!homes.length) return pick(rand, nav.homes);
    let index = Math.floor(rand() * homes.length);
    if (near) {
      const spot = nav.nodes[nav.key(near)].dir;
      index = homes.reduce((best, k, i) => (nav.nodes[nav.key(k)].dir.angleTo(spot) < nav.nodes[nav.key(homes[best])].dir.angleTo(spot) ? i : best), 0);
    }
    return homes.splice(index, 1)[0];
  };

  const add = (info, plan) => {
    const look = buildAlien(rand, info.role, info.kind === 'citizen');
    scene.add(look.group);
    const npc = {
      isAlien: true,
      ...info,
      plan: plan.sort((a, b) => a.at - b.at),
      group: look.group,
      legs: look.legs,
      pos: new THREE.Vector3(),
      height: 0,
      facing: new THREE.Vector3(),
      node: 0,
      path: [],
      segment: null,
      phase: rand() * 6,
      offset: new THREE.Vector2((rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8),
      state: 'idle',
      stop: null,
      talking: false,
    };
    npcs.push(npc);
    return npc;
  };

  for (const b of buildingServices) {
    b.stations.forEach((station, i) => {
      const home = takeHome(b.navKey('outside'));
      add(
        { kind: 'worker', name: takeName(), role: SERVICES[b.name]?.role ?? 'Shopkeeper', workplace: b.name, isManager: i === 0, station, home },
        workerPlan(rand, b, station, i, home),
      );
    });
  }
  for (const [name, info] of Object.entries(JOBS)) {
    const b = byName(name);
    if (!b) continue;
    const home = takeHome(b.navKey('outside'));
    add({ kind: 'helper', name: takeName(), role: info.helper, workplace: name, home }, helperPlan(rand, b, info, home));
  }
  for (let i = 0; i < CITIZENS; i++) {
    const home = takeHome();
    add({ kind: 'citizen', name: takeName(), role: 'Citizen', home }, citizenPlan(rand, home));
  }

  // Start everyone where their plan says they should be right now.
  for (const npc of npcs) {
    npc.stop = currentStop(npc);
    npc.node = nav.key(npc.stop.place);
    npc.pos.copy(nav.nodes[npc.node].dir);
    npc.height = nav.nodes[npc.node].height;
    npc.facing.copy(tangentToward(npc.pos, nav.nodes[npc.node].links[0]));
    arrive(npc);
  }
}

function currentStop(npc) {
  let current = npc.plan[npc.plan.length - 1];
  for (const s of npc.plan) if (s.at <= clock.minutes) current = s;
  return current;
}

const _axis = new THREE.Vector3();
function tangentToward(from, nodeIndex) {
  const to = nav.nodes[nodeIndex]?.dir;
  if (!to) return new THREE.Vector3(1, 0, 0).addScaledVector(from, -from.x).normalize();
  return to.clone().addScaledVector(from, -to.dot(from)).normalize();
}

function arrive(npc) {
  npc.path = [];
  npc.segment = null;
  const kind = npc.stop.kind;
  npc.state = kind === 'work' ? 'working' : kind === 'sleep' ? 'sleeping' : kind === 'task' ? 'busy' : 'visiting';
  npc.group.visible = npc.state !== 'sleeping';
  if (npc.state === 'working' && npc.station) npc.facing.copy(npc.station.customer).addScaledVector(npc.pos, -npc.station.customer.dot(npc.pos)).normalize();
}

function headTo(npc, place) {
  const goal = nav.key(place);
  if (goal === undefined) return;
  const from = npc.path.length ? npc.path[0] : npc.node;
  const route = findPath(from, goal);
  npc.path = npc.path.length ? [npc.path[0], ...route.slice(1)] : route.slice(1);
  npc.group.visible = true;
  npc.state = 'walking';
  if (!npc.path.length) arrive(npc);
}

const _basis = new THREE.Matrix4();
const _side = new THREE.Vector3();
const _place = new THREE.Vector3();

export function updateNPCs(dt) {
  for (const npc of npcs) {
    const wanted = currentStop(npc);
    if (wanted !== npc.stop) {
      npc.stop = wanted;
      headTo(npc, wanted.place);
    }
    let moving = false;
    if (!npc.talking && npc.path.length) {
      const target = nav.nodes[npc.path[0]];
      if (!npc.segment) npc.segment = { from: npc.pos.clone(), height: npc.height, length: Math.max(1e-6, npc.pos.angleTo(target.dir)) };
      const left = npc.pos.angleTo(target.dir);
      const step = (WALK_SPEED * dt) / RADIUS;
      if (left <= step) {
        npc.pos.copy(target.dir);
        npc.node = npc.path.shift();
        npc.height = target.height;
        npc.segment = null;
        if (!npc.path.length) arrive(npc);
      } else {
        _axis.crossVectors(npc.pos, target.dir).normalize();
        npc.pos.applyAxisAngle(_axis, step).normalize();
        const progress = 1 - (left - step) / npc.segment.length;
        npc.height = npc.segment.height + (target.height - npc.segment.height) * progress;
        npc.facing.copy(target.dir).addScaledVector(npc.pos, -target.dir.dot(npc.pos)).normalize();
        moving = true;
      }
    }
    if (!npc.group.visible) continue;

    npc.phase += dt * (moving ? 8 : 0);
    const swing = moving ? Math.sin(npc.phase) * 0.6 : 0;
    npc.legs[0].rotation.x += (swing - npc.legs[0].rotation.x) * 0.3;
    npc.legs[1].rotation.x += (-swing - npc.legs[1].rotation.x) * 0.3;

    const up = npc.pos;
    _place.copy(up);
    if (npc.state === 'visiting' && !moving) {
      _side.crossVectors(up, npc.facing);
      _place.addScaledVector(_side, npc.offset.x / RADIUS).addScaledVector(npc.facing, npc.offset.y / RADIUS).normalize();
    }
    npc.facing.addScaledVector(up, -npc.facing.dot(up)).normalize();
    _side.crossVectors(up, npc.facing);
    _basis.makeBasis(_side, up, npc.facing);
    npc.group.quaternion.setFromRotationMatrix(_basis);
    npc.group.position.copy(_place).multiplyScalar(RADIUS + npc.height);
  }
}

// Makes an alien turn to face the player while talking.
export function faceTowards(npc, position) {
  const dir = position.clone().normalize();
  npc.facing.copy(dir).addScaledVector(npc.pos, -dir.dot(npc.pos)).normalize();
}

export function nearestNPC(position, range = 3) {
  let best = null;
  let bestDistance = range;
  for (const npc of npcs) {
    if (!npc.group.visible) continue;
    const d = npc.group.position.distanceTo(position);
    if (d < bestDistance) {
      best = npc;
      bestDistance = d;
    }
  }
  return best;
}

// ---------- What aliens say about themselves ----------

export function introduce(npc) {
  if (npc.kind === 'citizen') return `I'm ${npc.name}! I live at the edge of town. I don't have a job, so I spend my days visiting shops and walking around.`;
  const first = npc.plan.find((s) => s.kind === 'work' || s.kind === 'task');
  const start = first.at + (npc.kind === 'worker' ? COMMUTE : 45);
  const boss = npc.isManager ? " I'm also the manager here." : '';
  return `I'm ${npc.name}, the ${npc.role.toLowerCase()} at the ${npc.workplace.toLowerCase()}. I start work at ${timeText(start)}.${boss}`;
}

export function describeDay(npc) {
  const lines = [];
  let lastLabel = '';
  for (const s of npc.plan) {
    if (s.kind === 'task') {
      if (lastLabel !== 'task') lines.push(`from ${timeText(s.at)} I do my work for the ${npc.workplace.toLowerCase()}`);
      lastLabel = 'task';
      continue;
    }
    lastLabel = s.kind;
    const doing = s.kind === 'work' ? `I walk to work at the ${npc.workplace.toLowerCase()}` : s.kind === 'sleep' ? 'I walk home to sleep' : `I'm ${s.label}`;
    lines.push(`at ${timeText(s.at)} ${doing}`);
  }
  const text = lines.join(', then ');
  return `Every day: ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export function whereGoing(npc) {
  if (npc.state === 'walking') return `I'm on my way, ${npc.stop.label}.`.replace('on my way, at home, asleep', 'on my way home to sleep');
  if (npc.state === 'working') return `I'm working right now. Can I help you?`;
  return `Right now I'm ${npc.stop.label}.`;
}

export function randomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export { timeText };
