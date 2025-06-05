import * as THREE from 'three';

export class ARManager {
  constructor(sceneManager, uiManager) {
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;

    if (!this.sceneManager.scene) {
      throw new Error('SceneManager must be initialized before creating ARManager');
    }

    this.isActive = false;
    this.reticle = null;
    this.hitTestSource = null;
    this.modelPlaced = false;
    this.arModel = null;
    this.arHotspots = [];
    this.hotspotsData = [];
    this.raycaster = new THREE.Raycaster();
    this.xrSession = null;
    this.viewerReferenceSpace = null;
    this.localReferenceSpace = null;

    this.createReticle();
  }

  createReticle() {
    const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(geometry, material);
    this.reticle.visible = false;
    this.reticle.matrixAutoUpdate = false;
    this.sceneManager.scene.add(this.reticle);
  }

  async init(model, hotspotsData) {
    this.model = model;
    this.hotspotsData = hotspotsData;

    if ('xr' in navigator) {
      try {
        console.log('Checking immersive-ar support...');
        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        console.log('immersive-ar support:', isSupported);

        if (isSupported) {
          this.uiManager.showARButton();
          this.setupARButton();
        } else {
          this.uiManager.showARError('AR Not Supported');
        }
      } catch (e) {
        console.error('Error checking XR support:', e);
        this.uiManager.showARError('AR Not Supported');
      }
    } else {
      this.uiManager.showARError('WebXR Not Available');
    }
  }

  setupARButton() {
    const arButton = document.getElementById('arButton');
    const exitARButton = document.getElementById('exitARButton');
    arButton.addEventListener('click', () => this.startAR());
    exitARButton.addEventListener('click', () => this.endAR());
  }

  async startAR() {
    try {
      console.log('Requesting camera access...');
      await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Camera access granted');
    } catch (err) {
      alert('Camera access is required for AR. Please grant camera permissions and try again.');
      console.error('Camera access failed:', err);
      return;
    }

    let session = null;
    try {
      // Enable XR on renderer first
      console.log('Enabling XR on renderer...');
      this.sceneManager.renderer.xr.enabled = true;
      
      console.log('Requesting XR session...');
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'local'],
        domOverlay: { root: document.body },
      });
      console.log('XR session started:', session);

      // Store session reference early for cleanup
      this.xrSession = session;

      // Set event listeners FIRST (before any other setup)
      session.addEventListener('end', () => this.onSessionEnd());
      session.addEventListener('select', () => this.onSelect());

      // Setup WebGL layer early
      const gl = this.sceneManager.renderer.getContext();
      console.log('WebGL context retrieved');

      try {
        await gl.makeXRCompatible();
        console.log('WebGL made XR-compatible');
      } catch (glError) {
        console.error('WebGL XR compatibility failed:', glError);
        throw new Error('Graphics hardware not compatible with AR');
      }

      session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl),
      });
      console.log('XRWebGLLayer set');

      // Setup reference spaces
      console.log('Setting up reference spaces...');
      
      // Always start with viewer space as it's guaranteed to be supported
      try {
        this.viewerReferenceSpace = await session.requestReferenceSpace('viewer');
        console.log('Got viewer reference space');
      } catch (viewerErr) {
        console.error('Critical error: viewer reference space not supported:', viewerErr);
        throw new Error('This device does not support basic AR functionality');
      }

      // Try to get local reference space with fallback
      try {
        this.localReferenceSpace = await session.requestReferenceSpace('local');
        console.log('Got local reference space');
      } catch (localErr) {
        console.warn('"local" reference space not supported, using viewer as fallback:', localErr.message);
        this.localReferenceSpace = this.viewerReferenceSpace;
      }

      // Create hit test source
      try {
        this.hitTestSource = await session.requestHitTestSource({
          space: this.viewerReferenceSpace,
        });
        console.log('Hit test source created');
      } catch (hitTestError) {
        console.error('Hit test source creation failed:', hitTestError);
        throw new Error('AR tracking not available on this device');
      }

      // Set the session in the renderer using a more direct approach
      try {
        console.log('Setting session in renderer...');
        
        // Set session directly without awaiting
        this.sceneManager.renderer.xr.setSession(session);
        console.log('Session set into renderer');
        
        // Wait for next frame to ensure session is properly initialized
        await new Promise(resolve => {
          session.requestAnimationFrame(() => {
            console.log('First animation frame received');
            resolve();
          });
        });
        
      } catch (rendererError) {
        console.error('Renderer XR session setup failed:', rendererError);
        throw new Error('Failed to initialize AR display');
      }

      // Activate AR mode
      this.isActive = true;
      this.uiManager.setARMode(true);
      this.sceneManager.setARMode(true);

      if (this.model) this.model.scene.visible = false;
      if (this.arModel) {
        this.sceneManager.scene.remove(this.arModel);
        this.arModel = null;
      }

      this.reticle.visible = true;
      this.modelPlaced = false;
      this.clearARHotspots();
      
      console.log('AR session successfully initialized');
      
    } catch (e) {
      // Enhanced error logging
      console.error('AR session failed:', {
        name: e.name,
        message: e.message,
        code: e.code,
        stack: e.stack
      });
      
      // User-friendly error messages based on error type
      let userMessage = 'Failed to start AR session';
      if (e.name === 'NotSupportedError') {
        userMessage = 'AR is not supported on this device or browser';
      } else if (e.name === 'SecurityError') {
        userMessage = 'Camera permissions are required for AR';
      } else if (e.name === 'InvalidStateError') {
        userMessage = 'AR session is already active or device is busy';
      } else if (e.message) {
        userMessage = e.message;
      }
      
      alert(userMessage);
      
      // Comprehensive cleanup
      await this.cleanupFailedSession(session);
    }
  }

  async cleanupFailedSession(session) {
    console.log('Cleaning up failed AR session...');
    
    // Reset renderer XR state first
    if (this.sceneManager.renderer.xr) {
      try {
        // Disable XR rendering
        this.sceneManager.renderer.xr.enabled = false;
        
        // Clear the session if it exists
        if (this.sceneManager.renderer.xr.getSession()) {
          this.sceneManager.renderer.xr.setSession(null);
        }
      } catch (resetError) {
        console.warn('Error resetting renderer XR:', resetError);
      }
    }
    
    // Clean up session
    if (session && session.end && typeof session.end === 'function') {
      try {
        await session.end();
      } catch (endError) {
        console.warn('Error ending failed session:', endError);
      }
    }
    
    // Reset all AR state
    this.onSessionEnd();
  }

  onSessionEnd() {
    console.log('XR session ended');
    this.isActive = false;
    
    // Clear session reference first
    this.xrSession = null;
    
    // Reset UI and scene states
    this.uiManager.setARMode(false);
    this.sceneManager.setARMode(false);

    // Reset renderer XR state
    if (this.sceneManager.renderer.xr) {
      this.sceneManager.renderer.xr.enabled = false;
    }

    if (this.model) this.model.scene.visible = true;
    this.reticle.visible = false;

    if (this.arModel) {
      this.sceneManager.scene.remove(this.arModel);
      this.arModel = null;
    }

    this.clearARHotspots();
    this.hitTestSource = null;
    this.modelPlaced = false;
    this.viewerReferenceSpace = null;
    this.localReferenceSpace = null;
  }

  endAR() {
    if (this.xrSession) {
      this.xrSession.end();
    }
  }

  onSessionEnd() {
    console.log('XR session ended');
    this.isActive = false;
    this.xrSession = null;
    this.uiManager.setARMode(false);
    this.sceneManager.setARMode(false);

    if (this.model) this.model.scene.visible = true;
    this.reticle.visible = false;

    if (this.arModel) {
      this.sceneManager.scene.remove(this.arModel);
      this.arModel = null;
    }

    this.clearARHotspots();
    this.hitTestSource = null;
    this.modelPlaced = false;
    this.viewerReferenceSpace = null;
    this.localReferenceSpace = null;
  }

  onSelect() {
    if (this.modelPlaced || !this.reticle.visible) return;

    if (this.model) {
      this.arModel = this.model.scene.clone();
      this.arModel.position.setFromMatrixPosition(this.reticle.matrix);
      this.arModel.scale.set(0.5, 0.5, 0.5);
      this.sceneManager.scene.add(this.arModel);

      this.addARHotspots();

      this.modelPlaced = true;
      this.uiManager.hideARInstructions();
      this.reticle.visible = false;

      console.log('AR model placed');
    }
  }

  addARHotspots() {
    this.hotspotsData.forEach((hotspotData) => {
      const geometry = new THREE.SphereGeometry(0.08, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 2,
        shininess: 100,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(
        hotspotData.position.x,
        hotspotData.position.y,
        hotspotData.position.z
      );
      sphere.userData = hotspotData;
      this.arModel.add(sphere);
      this.arHotspots.push(sphere);
    });
    console.log(`Added ${this.arHotspots.length} hotspots to AR model`);
  }

  clearARHotspots() {
    this.arHotspots.forEach((hotspot) => {
      if (hotspot.parent) {
        hotspot.parent.remove(hotspot);
      }
    });
    this.arHotspots = [];
  }

  update() {
    if (!this.isActive) return;

    const session = this.sceneManager.renderer.xr.getSession();
    const frame = this.sceneManager.renderer.xr.getFrame();

    if (!this.modelPlaced && frame && session && this.hitTestSource && this.localReferenceSpace) {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(this.localReferenceSpace);

        if (pose) {
          this.reticle.visible = true;
          this.reticle.matrix.fromArray(pose.transform.matrix);
        } else {
          this.reticle.visible = false;
        }
      } else {
        this.reticle.visible = false;
      }
    }
  }

  checkARHotspotClick(mouse) {
    if (!this.arModel || this.arHotspots.length === 0) return null;

    this.raycaster.setFromCamera(mouse, this.sceneManager.camera);
    const intersects = this.raycaster.intersectObjects(this.arHotspots, true);
    return intersects.length > 0 ? intersects[0].object.userData : null;
  }

  isARActive() {
    return this.isActive;
  }
}