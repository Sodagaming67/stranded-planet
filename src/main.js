import * as THREE from 'three';
import { createWorld, RADIUS, heightAt } from './world.js';
import { createPlayer } from './player.js';
import { readInput } from './input.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
const player = createPlayer(scene, world.spawnDir, world.spawnFacing);

const camForward = world.spawnFacing.clone();
let pitch = 0.25;
let distance = 9;
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
  sun.position.copy(player.position).addScaledVector(up, 40).addScaledVector(sunSide, 25);
  sun.target.position.copy(player.position);
  skyLight.position.copy(up);
}

const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');
let shownHealth = -1;

function updateHud() {
  if (player.health === shownHealth) return;
  shownHealth = player.health;
  healthFill.style.width = `${(100 * player.health) / player.maxHealth}%`;
  healthText.textContent = Math.ceil(player.health);
}

const hint = document.getElementById('hint');
const playText = document.getElementById('play-text');
const testMode = location.hash === '#test';
const isPlaying = () => testMode || !!document.pointerLockElement;
if (testMode) hint.style.display = 'none';

renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  hint.style.display = isPlaying() ? 'none' : 'flex';
  playText.textContent = 'Paused — click to keep playing';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const input = readInput();
  if (!isPlaying()) return;
  turnCamera(input);
  player.update(dt, input, camForward);
  followPlayer();
  world.update(now / 1000);
  updateHud();
  renderer.render(scene, camera);
});
