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
    this.hitTestSourceRequested = false;
    this.modelPlaced = false;
    this.arModel = null;
    this.arHotspots = [];
    this.hotspotsData = [];
    this.raycaster = new THREE.Raycaster();
    this.xrSession = null;

    this.viewerReferenceSpace = null;  // For hit test
    this.localReferenceSpace = null;   // For pose / rendering

    this.createReticle();
    this.setupEventListeners();
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
        console.log('AR not supported:', e);
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
    // Request camera permissions
    await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    alert('Camera access is required for AR. Please grant camera permissions and try again.');
    return;
  }

  try {
    this.xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body },
    });

    // ✅ Use the correct session object
    await this.sceneManager.renderer.xr.setSession(this.xrSession);

    // ✅ Store reference spaces
    this.xrRefSpace = await this.xrSession.requestReferenceSpace('local');
    this.xrViewerSpace = await this.xrSession.requestReferenceSpace('viewer');

    // ✅ Add 'select' event directly to the stored session
    this.xrSession.addEventListener('select', () => this.onSelect());
    this.xrSession.addEventListener('end', () => this.onSessionEnd());

    // ✅ Update states
    this.isActive = true;
    this.uiManager.setARMode(true);
    this.sceneManager.setARMode(true);

    if (this.model) {
      this.model.scene.visible = false;
    }

    this.modelPlaced = false;
    this.hitTestSourceRequested = false;
    this.reticle.visible = true;

    if (this.arModel) {
      this.sceneManager.scene.remove(this.arModel);
      this.arModel = null;
    }
    this.clearARHotspots();

    // ✅ Setup hit test source
    const viewerRefSpace = await this.xrSession.requestReferenceSpace('viewer');
    this.viewerReferenceSpace = viewerRefSpace;

    const hitTestSource = await this.xrSession.requestHitTestSource({ space: viewerRefSpace });
    this.hitTestSource = hitTestSource;

    this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');
  } catch (e) {
    console.error('Failed to start AR session:', e);
    alert('Failed to start AR session: ' + e.message);
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

    this.hitTestSourceRequested = false;
    this.hitTestSource = null;
    this.modelPlaced = false;

    this.viewerReferenceSpace = null;
    this.localReferenceSpace = null;
  }

  setupEventListeners() {
    this.sceneManager.renderer.xr.addEventListener('sessionstart', () => {
      const session = this.sceneManager.renderer.xr.getSession();
      session.addEventListener('select', () => this.onSelect());
    });
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

    if (intersects.length > 0) {
      return intersects[0].object.userData;
    }
    return null;
  }

  isARActive() {
    return this.isActive;
  }
}
