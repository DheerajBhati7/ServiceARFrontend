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
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
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
        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (isSupported) {
          this.uiManager.showARButton();
          this.setupARButton();
        } else {
          this.uiManager.showARError('AR Not Supported');
        }
      } catch (e) {
        console.error('AR not supported:', e);
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
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      alert('Camera access is required for AR. Please grant permissions and try again.');
      return;
    }

    try {
      // Use the same session configuration as the working WebXR sample
      this.xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test']
      });

      // Important: Set the session on the renderer first
      this.sceneManager.renderer.xr.setSession(this.xrSession);

      // Set up event listeners
      this.xrSession.addEventListener('end', () => this.onSessionEnd());
      this.xrSession.addEventListener('select', () => this.onSelect());

      // Request reference spaces - use the exact same approach as the working sample
      this.viewerReferenceSpace = await this.xrSession.requestReferenceSpace('viewer');
      this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

      // Request hit test source
      this.hitTestSource = await this.xrSession.requestHitTestSource({
        space: this.viewerReferenceSpace
      });

      this.isActive = true;
      this.uiManager.setARMode(true);
      this.sceneManager.setARMode(true);

      if (this.model) {
        this.model.scene.visible = false;
      }

      this.modelPlaced = false;
      this.reticle.visible = true;

      if (this.arModel) {
        this.sceneManager.scene.remove(this.arModel);
        this.arModel = null;
      }

      this.clearARHotspots();

      console.log('AR session started successfully');
    } catch (e) {
      console.error('Failed to start AR session:', e);
      
      // Try fallback approach if the standard approach fails
      if (e.message.includes('reference space') || e.message.includes('refrence space')) {
        console.log('Trying fallback reference space approach...');
        await this.startARFallback();
      } else {
        alert('Failed to start AR session: ' + e.message);
      }
    }
  }

  async startARFallback() {
    try {
      // End any existing session
      if (this.xrSession) {
        this.xrSession.end();
        this.xrSession = null;
      }

      // Try with minimal requirements - exactly like the working sample
      this.xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test']
      });

      this.sceneManager.renderer.xr.setSession(this.xrSession);
      
      this.xrSession.addEventListener('end', () => this.onSessionEnd());
      this.xrSession.addEventListener('select', () => this.onSelect());

      // Try only viewer space first (most widely supported)
      try {
        this.viewerReferenceSpace = await this.xrSession.requestReferenceSpace('viewer');
        console.log('Got viewer reference space');
      } catch (e) {
        throw new Error('Cannot get viewer reference space: ' + e.message);
      }

      // Try local space, but don't fail if it's not available
      try {
        this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');
        console.log('Got local reference space');
      } catch (e) {
        console.warn('Local reference space not available, using viewer as fallback');
        this.localReferenceSpace = this.viewerReferenceSpace;
      }

      // Request hit test source
      this.hitTestSource = await this.xrSession.requestHitTestSource({
        space: this.viewerReferenceSpace
      });

      this.isActive = true;
      this.uiManager.setARMode(true);
      this.sceneManager.setARMode(true);

      if (this.model) {
        this.model.scene.visible = false;
      }

      this.modelPlaced = false;
      this.reticle.visible = true;

      if (this.arModel) {
        this.sceneManager.scene.remove(this.arModel);
        this.arModel = null;
      }

      this.clearARHotspots();

      console.log('AR session started with fallback approach');
    } catch (e) {
      console.error('Fallback AR session also failed:', e);
      alert('AR is not supported on this device: ' + e.message);
    }
  }

  endAR() {
    if (this.xrSession) {
      this.xrSession.end();
    }
  }

  onSessionEnd() {
    this.isActive = false;
    this.xrSession = null;
    this.uiManager.setARMode(false);
    this.sceneManager.setARMode(false);

    if (this.model) {
      this.model.scene.visible = true;
    }

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
    if (!this.isActive || !this.xrSession) return;

    const frame = this.sceneManager.renderer.xr.getFrame();
    if (!frame) return;

    if (!this.modelPlaced && this.hitTestSource && this.localReferenceSpace) {
      try {
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
      } catch (e) {
        console.warn('Hit test failed:', e);
        this.reticle.visible = false;
      }
    }
  }

  checkARHotspotClick(mouse) {
    if (!this.arModel || this.arHotspots.length === 0) return null;

    this.raycaster.setFromCamera(mouse, this.sceneManager.camera);
    const intersects = this.raycaster.intersectObjects(this.arHotspots, true);

    if (intersects.length > 0) {
      return intersects[0].object.userData;
    }
    return null;
  }

  isARActive() {
    return this.isActive;
  }
}