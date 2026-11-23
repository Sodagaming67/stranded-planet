import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05060f');

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 12);

scene.add(new THREE.AmbientLight('#8899ff', 0.5));
const sun = new THREE.DirectionalLight('#fff4e0', 2);
sun.position.set(5, 5, 5);
scene.add(sun);

const planet = new THREE.Mesh(
  new THREE.IcosahedronGeometry(4, 2),
  new THREE.MeshStandardMaterial({ color: '#6fbf73', flatShading: true })
);
scene.add(planet);

const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(1500 * 3).map(() => (Math.random() - 0.5) * 400);
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.6 })));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  planet.rotation.y += 0.003;
  renderer.render(scene, camera);
});
