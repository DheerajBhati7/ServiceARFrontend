export class ApiService {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }
  
  async fetchHotspots() {
    try {
      console.log('Fetching from:', this.endpoint);
      const response = await fetch(this.endpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('API Response:', data);
      
      const hotspots = data.flatMap(item => item.hotspots || []);
      console.log('Extracted hotspots:', hotspots);
      return hotspots;
    } catch (error) {
      console.error('Error fetching hotspots:', error);
      throw error;
    }
  }
}