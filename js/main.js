import { SceneManager } from './scene-manager.js';
import { ModelLoader } from './model-loader.js';
import { HotspotManager } from './hotspot-manager.js';
import { ARManager } from './ar-manager.js';
import { UIManager } from './ui-manager.js';
import { ApiService } from './api-service.js';

// Configuration
const CONFIG = {
  MODEL_ID: 'fmx',
  VARIANT_ID: '2119',
  MODEL_PATH: 'models/fmx+460.glb', // Update this path as needed
  API_ENDPOINT: 'https://67c826d70acf98d070852750.mockapi.io/hotspot'
};

// Initialize managers
const sceneManager = new SceneManager();
const modelLoader = new ModelLoader(sceneManager);
const hotspotManager = new HotspotManager(sceneManager);
// Make hotspotManager globally accessible for AR manager
window.hotspotManager = hotspotManager;
const uiManager = new UIManager();
const apiService = new ApiService(CONFIG.API_ENDPOINT);
let arManager;

// Initialize the application
async function init() {
  try {
    // Set up scene FIRST
    sceneManager.init();
    
    // NOW create ARManager after scene is initialized
    arManager = new ARManager(sceneManager, uiManager);
    
    // Set up UI event handlers
    uiManager.init();
    
    // Load model
    const model = await modelLoader.loadModel(CONFIG.MODEL_PATH, (progress) => {
      uiManager.updateProgress(progress);
    });
    
    // Load hotspots from API
    console.log('Fetching hotspots...');
    const hotspotsData = await apiService.fetchHotspots();
    console.log('All hotspots data:', hotspotsData);
    
    const filteredHotspots = hotspotsData.filter(h => 
      h.modelId === CONFIG.MODEL_ID && h.variantId === CONFIG.VARIANT_ID
    );
    console.log('Filtered hotspots:', filteredHotspots);
    
    // Add hotspots to scene
    if (filteredHotspots.length > 0) {
      hotspotManager.addHotspots(filteredHotspots);
    } else {
      console.warn('No hotspots found for this model/variant combination');
      // For testing, add some dummy hotspots
      const dummyHotspots = [
        {
          hotspotName: "Test Hotspot 1",
          description: "This is a test hotspot",
          position: { x: 0.5, y: 0.5, z: 0 },
          videoLinks: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
        },
        {
          hotspotName: "Test Hotspot 2",
          description: "Another test hotspot",
          position: { x: -0.5, y: 0.5, z: 0 },
          videoLinks: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
        }
      ];
      hotspotManager.addHotspots(dummyHotspots);
    }
    
    // Initialize AR if supported
    await arManager.init(model, filteredHotspots.length > 0 ? filteredHotspots : []);
    
    // Set up interaction handlers
    setupInteractions();
    
    // Start animation loop
    animate();
    
  } catch (error) {
    console.error('Initialization error:', error);
    uiManager.showError('Failed to initialize application: ' + error.message);
  }
}

// Set up mouse/touch interactions
function setupInteractions() {
  const mouse = { x: 0, y: 0 };
  const mousePixels = { x: 0, y: 0 };
  
  // Track mouse movement
  window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mousePixels.x = event.clientX;
    mousePixels.y = event.clientY;
    
    // Handle hover only in non-AR mode
    if (!arManager || !arManager.isARActive()) {
      const hoveredHotspot = hotspotManager.checkHover(mouse, sceneManager.camera);
      if (hoveredHotspot) {
        uiManager.showTooltip(hoveredHotspot.hotspotName, mousePixels.x, mousePixels.y);
        document.body.style.cursor = 'pointer';
      } else {
        uiManager.hideTooltip();
        document.body.style.cursor = 'default';
      }
    }
  });
  
  // Handle clicks
  window.addEventListener('click', (event) => {
    // Prevent clicking through UI elements
    if (event.target.closest('#hotspotInfo') || 
        event.target.closest('#arButton') || 
        event.target.closest('#exitARButton')) {
      return;
    }
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    let clickedHotspot;
    if (arManager && arManager.isARActive()) {
      clickedHotspot = arManager.checkARHotspotClick(mouse);
    } else {
      clickedHotspot = hotspotManager.checkClick(mouse, sceneManager.camera);
    }
    
    if (clickedHotspot) {
      console.log('Showing hotspot info:', clickedHotspot);
      uiManager.showHotspotInfo(clickedHotspot);
    } else {
      uiManager.hideHotspotInfo();
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    sceneManager.handleResize();
  });
}

// Animation loop
function animate() {
  if (arManager && arManager.isARActive()) {
    arManager.update();
  } else {
    sceneManager.update();
  }
  
  sceneManager.render();
  sceneManager.renderer.setAnimationLoop(animate);
}

// Start the application
init();