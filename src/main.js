import * as THREE from 'three';
import { createWorld, RADIUS, heightAt } from './world.js';
import { createPlayer } from './player.js';
import { readInput } from './input.js';
import { wallet } from './money.js';
import { vaultDoors, buildingServices, setNightGlow } from './town.js';
import { towards } from './geo.js';
import { clock } from './clock.js';
import { setPlayer, onMessage } from './economy.js';
import { buildNavigation } from './navigation.js';
import { createNPCs, updateNPCs, nearestNPC, faceTowards } from './npcs.js';
import { initJobs, updateJobs, doTaskNear, taskNear, onJobMessage } from './jobs.js';
import { ui, openTalk, openBag, closeUI, setPrompt, updateJobPanel } from './ui.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1026');

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);

const skyLight = new THREE.HemisphereLight('#cfe8ff', '#4a3560', 2);
scene.add(skyLight);
const sun = new THREE.DirectionalLight('#fff1dc', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

const world = createWorld(scene);
// Test shortcuts: #test-town starts at the town gate; #test-in=BAKERY starts just inside that building.
const lettersOf = (text) => text.toUpperCase().replace(/[^A-Z]/g, '');
const insideName = lettersOf(decodeURIComponent(location.hash.match(/^#test-in=([^&]+)/)?.[1] ?? ''));
const insideOf = insideName ? buildingServices.find((b) => lettersOf(b.name).includes(insideName)) : undefined;
const atTown = location.hash.startsWith('#test-town');
const start = insideOf
  ? { dir: insideOf.door.inside, facing: towards(insideOf.door.inside, insideOf.stations[0]?.worker ?? insideOf.door.inside) }
  : atTown
    ? { dir: world.townGate, facing: world.townGateFacing }
    : { dir: world.spawnDir, facing: world.spawnFacing };
const player = createPlayer(scene, start.dir, start.facing);
// Test shortcuts: add "&time=21" to start at 9 PM, "&talk" to start talking to the nearest alien.
const startHour = location.hash.match(/time=(\d+)/);
if (startHour) clock.minutes = Number(startHour[1]) * 60;
buildNavigation(heightAt);
createNPCs(scene);
initJobs(scene);

const camForward = start.facing.clone();
let pitch = 0.25;
let distance = insideOf ? 3.5 : 9;
const up = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const sunSide = new THREE.Vector3();
const SUN_HINT = new THREE.Vector3(1, 0.3, 0.2).normalize();

function turnCamera(input) {
  up.copy(player.position).normalize();
  camForward.addScaledVector(up, -camForward.dot(up)).normalize();
  camForward.applyAxisAngle(up, -input.dx * 0.0025);
  pitch = THREE.MathUtils.clamp(pitch + input.dy * 0.002, -0.35, 1.3);
  distance = THREE.MathUtils.clamp(distance + input.wheel * 0.01, 4, 18);
}

function followPlayer() {
  up.copy(player.position).normalize();
  camForward.addScaledVector(up, -camForward.dot(up)).normalize();
  lookAt.copy(player.position).addScaledVector(up, 1.7);
  camera.position.copy(lookAt)
    .addScaledVector(camForward, -distance * Math.cos(pitch))
    .addScaledVector(up, distance * Math.sin(pitch));
  const camDir = camera.position.clone().normalize();
  const minHeight = RADIUS + heightAt(camDir) + 0.5;
  if (camera.position.length() < minHeight) camera.position.setLength(minHeight);
  camera.up.copy(up);
  camera.lookAt(lookAt);

  sunSide.copy(SUN_HINT).addScaledVector(up, -SUN_HINT.dot(up)).normalize();
  updateDaylight();
  sun.target.position.copy(player.position);
  skyLight.position.copy(up);
}

// Day and night: the sun rises at 6 AM, is highest at noon and sets at 6 PM. At night a soft blue moonlight shines.
const SKY = {
  day: new THREE.Color('#7fb2e6'),
  night: new THREE.Color('#060a1a'),
  dusk: new THREE.Color('#f29e6b'),
  sun: new THREE.Color('#fff1dc'),
  moon: new THREE.Color('#9fb4ff'),
  lightDay: new THREE.Color('#cfe8ff'),
  lightNight: new THREE.Color('#3a4a8a'),
  groundDay: new THREE.Color('#4a3560'),
  groundNight: new THREE.Color('#1a1530'),
};

function updateDaylight() {
  const angle = ((clock.minutes / 60 - 6) / 12) * Math.PI;
  const height = Math.sin(angle);
  const day = THREE.MathUtils.smoothstep(height, -0.12, 0.3);
  const dusk = Math.max(0, 1 - Math.abs(height) / 0.25);
  const sunUp = height > -0.05;
  sun.position.copy(player.position)
    .addScaledVector(up, 45 * (sunUp ? Math.max(height, 0.15) : 0.6))
    .addScaledVector(sunSide, 45 * (sunUp ? Math.cos(angle) : -0.5));
  sun.color.copy(SKY.moon).lerp(SKY.sun, day);
  sun.intensity = 0.45 + 2.6 * day;
  skyLight.intensity = 0.5 + 1.5 * day;
  skyLight.color.copy(SKY.lightNight).lerp(SKY.lightDay, day);
  skyLight.groundColor.copy(SKY.groundNight).lerp(SKY.groundDay, day);
  scene.background.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.dusk, dusk * 0.45);
  world.stars.opacity = 1 - day;
  setNightGlow(1 - day);
}

const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');
const notice = document.getElementById('notice');
const clockText = document.getElementById('clock');
let shownNotice = '';
let message = '';
let messageUntil = 0;
setPlayer(player);
const showMessage = (text) => {
  message = text;
  messageUntil = performance.now() + 6000;
};
onMessage(showMessage);
onJobMessage(showMessage);

function updateNotice() {
  const vault = vaultDoors.find((v) => !v.isOpen && v.position.distanceTo(player.position) < 3.5);
  let text = vault ? `The ${vault.name.toLowerCase()} is locked. Only the aliens who work at the bank can open it.` : '';
  if (performance.now() < messageUntil && !ui.open) text = message;
  if (text === shownNotice) return;
  shownNotice = text;
  notice.textContent = text;
  notice.style.display = text ? 'block' : 'none';
}

const goldCount = document.getElementById('gold-count');
const silverCount = document.getElementById('silver-count');
let shownHealth = -1;
let shownMoney = '';

function updateHud() {
  if (player.health !== shownHealth) {
    shownHealth = player.health;
    healthFill.style.width = `${(100 * player.health) / player.maxHealth}%`;
    healthText.textContent = Math.ceil(player.health);
  }
  const money = `${wallet.gold}/${wallet.silver}`;
  if (money !== shownMoney) {
    shownMoney = money;
    goldCount.textContent = wallet.gold;
    silverCount.textContent = wallet.silver;
  }
  const time = clock.text();
  if (clockText.textContent !== time) clockText.textContent = time;
}

const hint = document.getElementById('hint');
const playText = document.getElementById('play-text');
const testMode = location.hash.startsWith('#test');
const isPlaying = () => testMode || ui.open || !!document.pointerLockElement;
if (testMode) hint.style.display = 'none';

renderer.domElement.addEventListener('click', () => {
  if (!ui.open) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  hint.style.display = isPlaying() ? 'none' : 'flex';
  playText.textContent = 'Paused — click to keep playing';
});

// Opening a menu frees the mouse so you can click options; closing it goes back to playing.
function openMenu(open) {
  open((resume) => {
    if (resume && !testMode) renderer.domElement.requestPointerLock();
    else hint.style.display = isPlaying() ? 'none' : 'flex';
  });
  document.exitPointerLock();
}

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && ui.open) closeUI(false);
  if (!isPlaying() || e.repeat) return;
  if (e.code === 'KeyB') {
    if (ui.open) closeUI(true);
    else openMenu((close) => openBag(close));
  }
  if (e.code === 'KeyE' && !ui.open) {
    if (doTaskNear(player.position)) return;
    const npc = nearestNPC(player.position, 3.2);
    if (npc) {
      faceTowards(npc, player.position);
      openMenu((close) => openTalk(npc, close));
    }
  }
});

function updatePrompt() {
  const task = taskNear(player.position);
  if (task) return setPrompt(`<b>E</b> ${task.label}`);
  const npc = nearestNPC(player.position, 3.2);
  setPrompt(npc ? `<b>E</b> Talk to ${npc.name} (${npc.kind === 'citizen' ? 'citizen' : npc.role.toLowerCase()})` : '');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05);
  last = now;
  const input = readInput();
  if (!isPlaying()) return;
  if (ui.open) Object.assign(input, { forward: 0, right: 0, jump: false, dx: 0, dy: 0 });
  turnCamera(input);
  player.update(dt, input, camForward);
  followPlayer();
  clock.update(dt);
  world.update(now / 1000, dt);
  updateNPCs(dt);
  updateJobs(now / 1000);
  updateHud();
  updateNotice();
  updatePrompt();
  updateJobPanel();
  renderer.render(scene, camera);
});

if (location.hash.includes('talk')) {
  setTimeout(() => {
    const npc = nearestNPC(player.position, 80);
    if (npc) openMenu((close) => openTalk(npc, close));
  }, 1500);
}
