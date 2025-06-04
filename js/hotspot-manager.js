import * as THREE from 'three';

export class HotspotManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.hotspots = [];
    this.raycaster = new THREE.Raycaster();
    this.hoveredHotspot = null;
  }
  
  addHotspots(hotspotsData) {
    // Clear existing hotspots first
    this.clearHotspots();
    
    hotspotsData.forEach(hotspotData => {
      const hotspot = this.createHotspot(hotspotData);
      this.hotspots.push(hotspot);
      this.sceneManager.scene.add(hotspot);
    });
    
    console.log(`Added ${this.hotspots.length} hotspots to scene`);
  }
  
  createHotspot(data) {
    const geometry = new THREE.SphereGeometry(0.08, 32, 32);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
      shininess: 100
    });
    const sphere = new THREE.Mesh(geometry, material);
    
    // Make sure position data exists
    if (data.position) {
      sphere.position.set(
        data.position.x || 0, 
        data.position.y || 0, 
        data.position.z || 0
      );
    }
    
    sphere.userData = data;
    sphere.name = 'hotspot';
    return sphere;
  }
  
  clearHotspots() {
    this.hotspots.forEach(hotspot => {
      this.sceneManager.scene.remove(hotspot);
    });
    this.hotspots = [];
  }
  
  checkHover(mouse, camera) {
    if (this.hotspots.length === 0) return null;
    
    this.raycaster.setFromCamera(mouse, camera);
    const intersects = this.raycaster.intersectObjects(this.hotspots, false);
    
    if (intersects.length > 0) {
      const hotspot = intersects[0].object.userData;
      this.hoveredHotspot = hotspot;
      return hotspot;
    } else {
      this.hoveredHotspot = null;
      return null;
    }
  }
  
  checkClick(mouse, camera) {
    console.log('checkClick called');
    if (this.hotspots.length === 0) return null;
    
    this.raycaster.setFromCamera(mouse, camera);
    const intersects = this.raycaster.intersectObjects(this.hotspots, false);
    
    if (intersects.length > 0) {
      console.log('Hotspot clicked:', intersects[0].object.userData);
      return intersects[0].object.userData;
    }
    return null;
  }
  
  hideHotspots() {
    this.hotspots.forEach(hotspot => {
      hotspot.visible = false;
    });
  }
  
  showHotspots() {
    this.hotspots.forEach(hotspot => {
      hotspot.visible = true;
    });
  }
  
  getHotspots() {
    return this.hotspots;
  }
}
