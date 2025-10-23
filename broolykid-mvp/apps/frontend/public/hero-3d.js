// Three.js Hero 3D Animation pour BroolyKid
// Inspiré d'igloo.inc avec style spirituel

(function () {
  // Attendre que Three.js soit chargé
  function initHero3D() {
    if (typeof THREE === 'undefined') {
      setTimeout(initHero3D, 100);
      return;
    }

    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.001);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xff6b9d, 2, 100); // Rose
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x8b5cf6, 2, 100); // Violet
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x4f46e5, 2, 100); // Bleu
    pointLight3.position.set(0, 10, -10);
    scene.add(pointLight3);

    // Optimisation mobile
    const isMobile = window.innerWidth < 768;
    const particlesCount = isMobile ? 500 : 2000;
    const positions = new Float32Array(particlesCount * 3);
    const colors = new Float32Array(particlesCount * 3);
    const sizes = new Float32Array(particlesCount);

    const spiritualColors = [
      new THREE.Color(0xff6b9d), // Rose
      new THREE.Color(0x8b5cf6), // Violet
      new THREE.Color(0x4f46e5), // Bleu
      new THREE.Color(0xffd700), // Or
      new THREE.Color(0x48dbfb), // Cyan
    ];

    for (let i = 0; i < particlesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      const color = spiritualColors[Math.floor(Math.random() * spiritualColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 3 + 1;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Geometries spirituelles (Torus = Chakra, Icosahedron = Merkaba)
    const torusGeometry = new THREE.TorusGeometry(5, 1, 16, 100);
    const torusMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    scene.add(torus);

    const icosahedronGeometry = new THREE.IcosahedronGeometry(4, 1);
    const icosahedronMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b9d,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const icosahedron = new THREE.Mesh(icosahedronGeometry, icosahedronMaterial);
    icosahedron.position.set(15, 0, -10);
    scene.add(icosahedron);

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    document.addEventListener('mousemove', (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Scroll interaction
    let scrollY = 0;
    window.addEventListener('scroll', () => {
      scrollY = window.scrollY;
    });

    // Animation loop
    const clock = new THREE.Clock();
    let animationId = null;

    function animate() {
      animationId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Rotate particles
      particles.rotation.y = elapsedTime * 0.05;
      particles.rotation.x = elapsedTime * 0.03;

      // Rotate geometries
      torus.rotation.x = elapsedTime * 0.2;
      torus.rotation.y = elapsedTime * 0.3;

      icosahedron.rotation.x = -elapsedTime * 0.15;
      icosahedron.rotation.y = -elapsedTime * 0.25;

      // Smooth mouse interaction
      targetX += (mouseX * 5 - targetX) * 0.05;
      targetY += (mouseY * 5 - targetY) * 0.05;

      camera.position.x = targetX;
      camera.position.y = targetY;
      camera.lookAt(scene.position);

      // Lights orbit
      const time = elapsedTime * 0.5;
      pointLight1.position.x = Math.sin(time) * 15;
      pointLight1.position.z = Math.cos(time) * 15;

      pointLight2.position.x = Math.cos(time * 0.7) * 15;
      pointLight2.position.z = Math.sin(time * 0.7) * 15;

      pointLight3.position.y = Math.sin(time * 0.5) * 10;

      // Scroll effect
      camera.position.z = 30 + scrollY * 0.01;

      renderer.render(scene, camera);
    }

    animate();

    // Responsive
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Fonction de cleanup complète
    function cleanup() {
      console.log('🧹 Three.js cleanup starting...');

      // Arrêter l'animation
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      // Dispose renderer
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement = null;
      }

      // Traverse scene et dispose tous les objets
      if (scene) {
        scene.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }

      // Dispose manuellement des geometries et materials
      if (particlesGeometry) particlesGeometry.dispose();
      if (particlesMaterial) particlesMaterial.dispose();
      if (torusGeometry) torusGeometry.dispose();
      if (torusMaterial) torusMaterial.dispose();
      if (icosahedronGeometry) icosahedronGeometry.dispose();
      if (icosahedronMaterial) icosahedronMaterial.dispose();

      console.log('✅ Three.js cleanup completed');
    }

    // Event listeners pour cleanup
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    // Return cleanup pour utilisation externe
    return cleanup;
  }

  // Démarrer quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
  } else {
    initHero3D();
  }
})();
