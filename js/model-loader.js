import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.loader = new GLTFLoader();
    this.loadedModel = null;
  }
  
  loadModel(path, onProgress) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          console.log('Model loaded successfully.');
          this.loadedModel = gltf;
          
          // Process model
          this.processModel(gltf);
          
          // Add to scene
          this.sceneManager.scene.add(gltf.scene);
          
          // Update camera position
          this.adjustCamera(gltf.scene);
          
          if (onProgress) onProgress(100);
          resolve(gltf);
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            const percent = (xhr.loaded / xhr.total) * 100;
            onProgress(percent);
          }
        },
        (error) => {
          console.error('An error occurred while loading the model:', error);
          reject(error);
        }
      );
    });
  }
  
  processModel(gltf) {
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Scale model to fit in view
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1;
    gltf.scene.scale.multiplyScalar(scale);
    
    // Center the model
    gltf.scene.position.sub(center.multiplyScalar(scale));
    gltf.scene.position.y = 0;
    
    // Enhance materials and enable shadows
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Enhance material quality
        if (child.material) {
          child.material.envMapIntensity = 1;
          child.material.needsUpdate = true;
          
          if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
            child.material.roughness = child.material.roughness || 0.5;
            child.material.metalness = child.material.metalness || 0.5;
            
            if (!child.material.envMap) {
              child.material.envMap = this.sceneManager.scene.environment;
            }
          }
        }
      }
    });
  }
  
  adjustCamera(modelScene) {
    const box = new THREE.Box3().setFromObject(modelScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;
    
    this.sceneManager.camera.position.set(distance * 0.5, distance * 0.5, distance);
    this.sceneManager.controls.target.copy(center);
    this.sceneManager.controls.update();
  }
  
  getModel() {
    return this.loadedModel;
  }
}