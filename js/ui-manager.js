export class UIManager {
  constructor() {
    this.elements = {
      progressBar: document.getElementById('progressBar'),
      loaderContainer: document.getElementById('loaderContainer'),
      errorPanel: document.getElementById('errorPanel'),
      arButton: document.getElementById('arButton'),
      exitARButton: document.getElementById('exitARButton'),
      arInstructions: document.getElementById('arInstructions'),
      hotspotInfo: document.getElementById('hotspotInfo'),
      hotspotName: document.getElementById('hotspotName'),
      hotspotDescription: document.getElementById('hotspotDescription'),
      videoLinks: document.getElementById('videoLinks'),
      tooltip: document.getElementById('tooltip')
    };
    
    // Verify elements exist
    this.verifyElements();
  }
  
  verifyElements() {
    Object.entries(this.elements).forEach(([key, element]) => {
      if (!element) {
        console.error(`Element not found: ${key}`);
      }
    });
  }
  
  init() {
    // Initialize UI state
    if (this.elements.loaderContainer) {
      this.elements.loaderContainer.style.display = 'block';
    }
    this.hideError();
    this.hideHotspotInfo();
    this.hideTooltip();
    
    document.getElementById('arButton').style.display = 'block';

    // Add close button to hotspot info if it doesn't exist
    if (this.elements.hotspotInfo && !this.elements.hotspotInfo.querySelector('.close-button')) {
      const closeButton = document.createElement('button');
      closeButton.className = 'close-button';
      closeButton.innerHTML = '×';
      closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeButton.onclick = () => this.hideHotspotInfo();
      this.elements.hotspotInfo.insertBefore(closeButton, this.elements.hotspotInfo.firstChild);
    }
  }
  
  updateProgress(percent) {
    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = percent + '%';
    }
    if (percent >= 100) {
      setTimeout(() => {
        this.hideLoader();
      }, 300);
    }
  }
  
  hideLoader() {
    if (this.elements.loaderContainer) {
      this.elements.loaderContainer.style.display = 'none';
    }
  }
  
  showError(message) {
    if (this.elements.errorPanel) {
      this.elements.errorPanel.textContent = message;
      this.elements.errorPanel.style.display = 'block';
    }
  }
  
  hideError() {
    if (this.elements.errorPanel) {
      this.elements.errorPanel.style.display = 'none';
    }
  }
  
  showARButton() {
    console.log('showARButton called');
    if (this.elements.arButton) {
      console.log('AR button found, showing it');
      this.elements.arButton.style.display = 'block';
    } else {
      console.error('AR button element not found');
    }
  }
  
  showARError(message) {
    console.log('showARError called with message:', message);
    if (this.elements.arButton) {
      console.log('AR button found, showing error message');
      this.elements.arButton.style.display = 'block';
      this.elements.arButton.classList.add('ar-not-supported');
      this.elements.arButton.textContent = message;
      this.elements.arButton.disabled = true;
    } else {
      console.error('AR button element not found');
    }
  }
  
  setARMode(enabled) {
    if (enabled) {
      if (this.elements.arButton) this.elements.arButton.style.display = 'none';
      if (this.elements.exitARButton) this.elements.exitARButton.style.display = 'block';
      if (this.elements.arInstructions) this.elements.arInstructions.style.display = 'block';
      this.hideHotspotInfo();
      this.hideTooltip();
    } else {
      if (this.elements.arButton) this.elements.arButton.style.display = 'block';
      if (this.elements.exitARButton) this.elements.exitARButton.style.display = 'none';
      if (this.elements.arInstructions) this.elements.arInstructions.style.display = 'none';
    }
  }
  
  hideARInstructions() {
    if (this.elements.arInstructions) {
      this.elements.arInstructions.style.display = 'none';
    }
  }
  
  showTooltip(text, x, y) {
   if (!text || !this.elements.tooltip) return;
    this.elements.tooltip.textContent = text;
    this.elements.tooltip.style.display = 'block';
    this.elements.tooltip.style.left = x + 15 + 'px';
    this.elements.tooltip.style.top = y + 15 + 'px';
  }
  
  hideTooltip() {
    if (this.elements.tooltip) {
      this.elements.tooltip.style.display = 'none';
    }
  }
  
  showHotspotInfo(hotspotData) {
    console.log('showHotspotInfo called with data:', hotspotData);
    
    if (!hotspotData || !this.elements.hotspotInfo) {
      console.error('Cannot show hotspot info - missing data or element');
      return;
    }
    
    // Debug: Log elements
    console.log('Elements:', this.elements);
    
    // Debug: Log z-index of hotspotInfo and canvas
    console.log('hotspotInfo z-index:', window.getComputedStyle(this.elements.hotspotInfo).zIndex);
    const canvas = document.querySelector('canvas');
    if (canvas) {
      console.log('Canvas z-index:', window.getComputedStyle(canvas).zIndex);
    } else {
      console.log('Canvas not found');
    }
    
    // Update name
    if (this.elements.hotspotName) {
      console.log('Updating hotspot name:', hotspotData.hotspotName || 'Unnamed Hotspot');
      this.elements.hotspotName.textContent = hotspotData.hotspotName || 'Unnamed Hotspot';
    } else {
      console.error('hotspotName element not found');
    }
    
    // Update description
    if (this.elements.hotspotDescription) {
      console.log('Updating hotspot description:', hotspotData.description || 'No description available');
      this.elements.hotspotDescription.textContent = hotspotData.description || 'No description available';
    } else {
      console.error('hotspotDescription element not found');
    }
    
    // Clear and update video links
    if (this.elements.videoLinks) {
      console.log('Clearing video links');
      this.elements.videoLinks.innerHTML = '';
      
      // Parse and display video links
      const urls = this.parseVideoLinks(hotspotData.videoLinks);
      console.log('Parsed video URLs:', urls);
      
      if (urls.length > 0) {
        urls.forEach((url, index) => {
          const preview = this.createVideoPreview(url, index);
          this.elements.videoLinks.appendChild(preview);
        });
      } else {
        const noVideos = document.createElement('div');
        noVideos.className = 'video-error';
        noVideos.textContent = 'No videos available for this hotspot';
        this.elements.videoLinks.appendChild(noVideos);
      }
    } else {
      console.error('videoLinks element not found');
    }
    
    // Show the panel
    console.log('Showing hotspot info panel');
    this.elements.hotspotInfo.style.display = 'block';
  }
  
  hideHotspotInfo() {
    console.log('hideHotspotInfo called');
    if (this.elements.hotspotInfo) {
      this.elements.hotspotInfo.style.display = 'none';
    }
  }
  
  parseVideoLinks(videoLinks) {
    const allUrls = [];
    
    if (!videoLinks) {
      console.log('No video links provided');
      return allUrls;
    }
    
    console.log('Parsing video links:', videoLinks);
    
    if (Array.isArray(videoLinks)) {
      videoLinks.forEach(link => {
        if (typeof link === 'string' && link.trim()) {
          // Split by spaces in case multiple URLs are in one string
          const urls = link.trim().split(/\s+/);
          urls.forEach(url => {
            if (url && url.startsWith('http')) {
              allUrls.push(url);
            }
          });
        }
      });
    } else if (typeof videoLinks === 'string' && videoLinks.trim()) {
      // Handle single string
      const urls = videoLinks.trim().split(/\s+/);
      urls.forEach(url => {
        if (url && url.startsWith('http')) {
          allUrls.push(url);
        }
      });
    }
    
    console.log('Parsed URLs:', allUrls);
    return allUrls;
  }
  
  getYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
  
  createVideoPreview(url, index) {
    const videoId = this.getYouTubeVideoId(url);
    const previewDiv = document.createElement('div');
    previewDiv.className = 'video-preview';

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = `Video ${index + 1}`;
    previewDiv.appendChild(label);

    if (videoId) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.allowFullscreen = true;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      previewDiv.appendChild(iframe);

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.textContent = 'Open in YouTube →';
      previewDiv.appendChild(link);
    } else {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'video-error';
      errorDiv.textContent = 'Video preview not available';
      previewDiv.appendChild(errorDiv);

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.textContent = 'Open Video →';
      previewDiv.appendChild(link);
    }

    return previewDiv;
  }
}
