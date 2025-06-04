import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.lights = {};
    this.helpers = {};
    this.isARMode = false;
  }
  
  init() {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);
    this.scene.fog = new THREE.Fog(0xf5f5f5, 10, 50);
    
    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 5);
    
    // Initialize renderer with proper AR settings
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
      xrCompatible: true
    });
    
    // CRITICAL: Enable XR before setting other properties
    this.renderer.xr.enabled = true;
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // IMPORTANT: Don't set xrCompatible here - it can interfere with AR
    document.body.appendChild(this.renderer.domElement);
    
    // Create environment (only for non-AR mode)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    
    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 1;
    this.controls.maxDistance = 10;
    this.controls.update();
    
    // Set up lighting
    this.setupLighting();
    
    // Add helpers
    this.addHelpers();
  }
  
  setupLighting() {
    // Ambient light
    this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.lights.ambient);
    
    // Main directional light
    this.lights.main = new THREE.DirectionalLight(0xffffff, 1);
    this.lights.main.position.set(5, 10, 5);
    this.lights.main.castShadow = true;
    this.lights.main.shadow.camera.near = 0.1;
    this.lights.main.shadow.camera.far = 50;
    this.lights.main.shadow.camera.left = -10;
    this.lights.main.shadow.camera.right = 10;
    this.lights.main.shadow.camera.top = 10;
    this.lights.main.shadow.camera.bottom = -10;
    this.lights.main.shadow.mapSize.width = 2048;
    this.lights.main.shadow.mapSize.height = 2048;
    this.lights.main.shadow.bias = -0.0005;
    this.scene.add(this.lights.main);
    
    // Fill light
    this.lights.fill = new THREE.DirectionalLight(0xffffff, 0.3);
    this.lights.fill.position.set(-5, 5, -5);
    this.scene.add(this.lights.fill);
    
    // Rim light
    this.lights.rim = new THREE.DirectionalLight(0xffffff, 0.2);
    this.lights.rim.position.set(0, 5, -10);
    this.scene.add(this.lights.rim);
  }
  
  addHelpers() {
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ 
      opacity: 0.3,
      color: 0x000000
    });
    this.helpers.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.helpers.ground.rotation.x = -Math.PI / 2;
    this.helpers.ground.position.y = -0.01;
    this.helpers.ground.receiveShadow = true;
    this.scene.add(this.helpers.ground);
    
    // Grid
    this.helpers.grid = new THREE.GridHelper(10, 10, 0xcccccc, 0xe0e0e0);
    this.helpers.grid.material.opacity = 0.5;
    this.helpers.grid.material.transparent = true;
    this.scene.add(this.helpers.grid);
  }
  
  hideHelpers() {
    Object.values(this.helpers).forEach(helper => {
      helper.visible = false;
    });
  }
  
  showHelpers() {
    Object.values(this.helpers).forEach(helper => {
      helper.visible = true;
    });
  }
  
  update() {
    // Only update OrbitControls if NOT in XR session to avoid conflicts
    if (!this.renderer.xr.isPresenting) {
      this.controls.update();
    }
  }
  
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  
  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  setARMode(enabled) {
    this.isARMode = enabled;
    
    if (enabled) {
      // CRITICAL: Set background to null for camera passthrough
      this.scene.background = null;
      this.scene.fog = null;
      
      // Remove environment for AR
      this.scene.environment = null;
      
      // Hide helpers
      this.hideHelpers();
      
      // Adjust lighting for AR
      this.lights.ambient.intensity = 0.8;  // Increase ambient for AR
      this.lights.main.intensity = 0.5;     // Reduce main light
      
      // Make sure renderer alpha is enabled
      this.renderer.setClearColor(0x000000, 0);
      
    } else {
      // Restore normal mode
      this.scene.background = new THREE.Color(0xf5f5f5);
      this.scene.fog = new THREE.Fog(0xf5f5f5, 10, 50);
      
      // Restore environment
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      
      // Show helpers
      this.showHelpers();
      
      // Restore lighting
      this.lights.ambient.intensity = 0.4;
      this.lights.main.intensity = 1;
      
      // Restore clear color
      this.renderer.setClearColor(0xf5f5f5, 1);
    }
  }
}