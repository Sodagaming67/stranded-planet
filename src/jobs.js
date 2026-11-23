import * as THREE from 'three';
import { RADIUS } from './geo.js';
import { buildingServices } from './town.js';
import { nav } from './navigation.js';
import { payWages, cannotServe } from './economy.js';

// Jobs the player can do for pay. Each one is given out (and paid) by the manager of that building.
// The same jobs are also done by alien helpers around town.
export const JOBS = {
  'POST OFFICE': { title: 'Parcel delivery', helper: 'Courier', pay: 3, count: 4, kind: 'deliver', task: 'Deliver a parcel to the' },
  BAKERY: { title: 'Bread delivery', helper: 'Bread runner', pay: 3, count: 3, kind: 'deliver', task: 'Bring fresh bread to the', to: ['TAVERN', 'INN & HOTEL', 'HOSPITAL', 'LIBRARY', 'BANK'] },
  'INN & HOTEL': { title: 'Room cleaning', helper: 'Room cleaner', pay: 2, count: 4, kind: 'rooms' },
  'GENERAL STORE': { title: 'Stocking shelves', helper: 'Shelf stocker', pay: 2, count: 4, kind: 'spots' },
  LIBRARY: { title: 'Sorting books', helper: 'Book sorter', pay: 2, count: 4, kind: 'spots' },
};

export const job = { current: null };

const say = [];
function reply(ok, message) {
  say.forEach((fn) => fn(message));
  return { ok, message };
}

let markerGroup = null;
const markerMat = new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: 1.2, flatShading: true });
const markerGeo = new THREE.OctahedronGeometry(0.4, 0);

export function initJobs(scene) {
  markerGroup = new THREE.Group();
  scene.add(markerGroup);
}

function shuffle(list) {
  return list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

// The tasks for a job at this building: places to go, each with a label.
export function tasksFor(building) {
  const info = JOBS[building];
  const here = buildingServices.find((b) => b.name === building);
  if (!info || !here) return [];
  if (info.kind === 'deliver') {
    const places = buildingServices.filter((b) => b.name !== building && (!info.to || info.to.includes(b.name)));
    return shuffle(places).slice(0, info.count).map((b) => ({ label: `${info.task} ${b.name.toLowerCase()}`, dir: b.door.outside, node: b.navKey('outside') }));
  }
  if (info.kind === 'rooms') {
    return shuffle(here.rooms).slice(0, info.count).map((r) => ({ label: `Clean room ${r.number}`, dir: r.center, node: here.navKey(r.node) }));
  }
  return shuffle(here.workSpots).slice(0, info.count).map((w) => ({ label: w.label, dir: w.dir, node: here.navKey(w.node) }));
}

function showMarkers() {
  markerGroup.clear();
  for (const task of job.current?.tasks ?? []) {
    if (task.done) continue;
    const node = nav.nodes[nav.key(task.node)];
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.userData.base = task.dir.clone().multiplyScalar(RADIUS + (node?.height ?? 0) + 2.6);
    marker.position.copy(marker.userData.base);
    markerGroup.add(marker);
  }
}

export function updateJobs(t) {
  markerGroup?.children.forEach((m, i) => {
    m.position.copy(m.userData.base).addScaledVector(m.userData.base.clone().normalize(), Math.sin(t * 3 + i) * 0.25);
    m.rotation.y = t * 2;
  });
}

// A manager offers the player a job.
export function startJob(manager) {
  const building = manager?.workplace;
  const info = JOBS[building];
  if (!manager?.isAlien || !manager.isManager || !info) return reply(false, "I can't give you a job.");
  const problem = cannotServe(manager, building);
  if (problem) return reply(false, problem);
  if (job.current) return reply(false, `You already have a job: ${job.current.title.toLowerCase()} for ${job.current.building.toLowerCase()}.`);
  job.current = { building, title: info.title, pay: info.pay, manager: manager.name, tasks: tasksFor(building) };
  showMarkers();
  const total = info.pay * job.current.tasks.length;
  return reply(true, `You're hired for ${info.title.toLowerCase()}! Follow the glowing markers and press E at each one. Come back to me when you're done and I'll pay you ${total} silver.`);
}

// The player presses E near a task spot.
export function doTaskNear(position) {
  const task = job.current?.tasks.find((t) => !t.done && t.dir.angleTo(position.clone().normalize()) * RADIUS < 2.5);
  if (!task) return null;
  task.done = true;
  showMarkers();
  const left = job.current.tasks.filter((t) => !t.done).length;
  return reply(true, left ? `${task.label}: done! ${left} more to go.` : `${task.label}: done! Go back to ${job.current.manager} at the ${job.current.building.toLowerCase()} to get paid.`);
}

export function taskNear(position) {
  return job.current?.tasks.find((t) => !t.done && t.dir.angleTo(position.clone().normalize()) * RADIUS < 2.5) ?? null;
}

// The manager pays the player when all tasks are done.
export function finishJob(manager) {
  if (!job.current) return reply(false, "You don't have a job right now.");
  if (manager?.workplace !== job.current.building || !manager.isManager) return reply(false, `Go back to ${job.current.manager} at the ${job.current.building.toLowerCase()} to get paid.`);
  const left = job.current.tasks.filter((t) => !t.done).length;
  if (left) return reply(false, `You still have ${left} thing${left === 1 ? '' : 's'} to do.`);
  const result = payWages(manager, job.current.building, { silver: job.current.pay * job.current.tasks.length }, job.current.title);
  if (result.ok) {
    job.current = null;
    showMarkers();
  }
  return result;
}

export function quitJob() {
  if (!job.current) return reply(false, "You don't have a job.");
  const title = job.current.title;
  job.current = null;
  showMarkers();
  return reply(true, `You quit ${title.toLowerCase()}. No pay for unfinished work.`);
}

export function onJobMessage(fn) {
  say.push(fn);
}
