import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Get canvas element
const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();

// Add atmospheric fog
scene.fog = new THREE.FogExp2(0x00111a, 0.015);

// Setup renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// Setup camera
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.5, 6);
scene.add(camera);

// Lighting setup
const ambient = new THREE.AmbientLight(0x99ccff, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(5, 8, 2);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Add some atmospheric lighting
const pointLight = new THREE.PointLight(0x4a90e2, 0.8, 100);
pointLight.position.set(-5, 3, 5);
scene.add(pointLight);

// Load the Earth model
const loader = new GLTFLoader();
let model;
let isModelLoaded = false;

loader.load('/the_young_mother_earth.glb', (gltf) => {
  model = gltf.scene;
  model.scale.set(1.8, 1.8, 1.8);
  model.position.set(0, 0, 0);
  scene.add(model);
  isModelLoaded = true;

  // Initial entrance animation
  gsap.from(model.position, {
    y: -2,
    duration: 2,
    ease: 'power3.out'
  });

  gsap.from(model.rotation, {
    y: Math.PI * 0.5,
    duration: 2,
    ease: 'power3.out'
  });

  // Add subtle glow effect
  gsap.to(model, {
    duration: 4,
    ease: 'power2.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: function () {
      if (model) {
        model.children.forEach(child => {
          if (child.material && child.material.emissive) {
            child.material.emissive.setHex(0x001122);
            child.material.emissiveIntensity = 0.1 + Math.sin(Date.now() * 0.001) * 0.05;
          }
        });
      }
    }
  });

  console.log('🌍 Young Mother Earth model loaded successfully!');
}, undefined, (error) => {
  console.error('Error loading model:', error);
  // Create a fallback sphere if model fails to load
  createFallbackEarth();
});

// Fallback Earth if model doesn't load
function createFallbackEarth() {
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshPhongMaterial({
    color: 0x4a90e2,
    emissive: 0x001122,
    emissiveIntensity: 0.1,
    shininess: 100
  });

  model = new THREE.Mesh(geometry, material);
  model.scale.set(1.8, 1.8, 1.8);
  scene.add(model);
  isModelLoaded = true;

  console.log('🌍 Using fallback Earth model');
}

// Mouse interaction
const mouse = { x: 0, y: 0 };
let mouseTarget = { x: 0, y: 0 };

window.addEventListener('mousemove', (e) => {
  mouseTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

// Smooth mouse following
function updateMouse() {
  mouse.x += (mouseTarget.x - mouse.x) * 0.1;
  mouse.y += (mouseTarget.y - mouse.y) * 0.1;
}

// Parallax camera movement
function parallax() {
  updateMouse();

  const targetX = mouse.x * 0.5;
  const targetY = -mouse.y * 0.5 + 1.5;

  camera.position.x += (targetX - camera.position.x) * 0.05;
  camera.position.y += (targetY - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);
}

// Scroll-based camera animation
const scrollTimeline = gsap.timeline({
  scrollTrigger: {
    trigger: document.body,
    start: 'top top',
    end: '+=2000',
    scrub: 1,
    onUpdate: (self) => {
      // Add some dynamic lighting based on scroll
      const progress = self.progress;
      dirLight.intensity = 1.3 + Math.sin(progress * Math.PI) * 0.3;
      pointLight.intensity = 0.8 + Math.cos(progress * Math.PI) * 0.2;
    }
  },
});

// Camera movement sequence
scrollTimeline
  .to(camera.position, {
    z: 4.5,
    duration: 1,
    ease: 'power2.inOut'
  })
  .to(camera.position, {
    x: 1.5,
    y: 2.2,
    z: 5.5,
    duration: 1,
    ease: 'power2.inOut'
  })
  .to(camera.position, {
    x: -1.5,
    y: 1.8,
    z: 4.8,
    duration: 1,
    ease: 'power2.inOut'
  })
  .to(camera.position, {
    x: 0,
    y: 0.5,
    z: 3.5,
    duration: 1,
    ease: 'power2.inOut'
  });

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Rotate the Earth
  if (model && isModelLoaded) {
    model.rotation.y += 0.0015;
    // Add subtle wobble
    model.rotation.x = Math.sin(Date.now() * 0.0005) * 0.02;
  }

  // Update parallax
  parallax();

  // Render the scene
  renderer.render(scene, camera);
}

// Start the animation loop
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add some performance monitoring
let frameCount = 0;
setInterval(() => {
  frameCount = 0;
}, 1000);

// Performance optimization
function optimizePerformance() {
  frameCount++;
  if (frameCount > 60) {
    // Reduce quality if performance is poor
    renderer.setPixelRatio(1);
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}

// Add to animation loop
const originalAnimate = animate;
animate = function () {
  optimizePerformance();
  originalAnimate();
};

console.log('🚀 Young Mother Earth experience initialized!');
console.log('📁 Make sure to place your the_young_mother_earth.glb file in the public/ folder');
