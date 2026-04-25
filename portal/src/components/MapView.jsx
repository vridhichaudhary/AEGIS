import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers } from 'lucide-react';

// Fix Leaflet default icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEPOTS = [
  { id: 'depot-south', lat: 28.5670, lng: 77.2100, name: 'South Delhi Depot' },
  { id: 'depot-central', lat: 28.6304, lng: 77.2177, name: 'Central Command' },
  { id: 'depot-north', lat: 28.7041, lng: 77.1025, name: 'North Delhi Station' },
];

const MapView = ({ incidents, resources }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  
  const markersRef = useRef({ incidents: {}, resources: {}, depots: [], coverage: [] });
  const resourceState = useRef(new Map());
  const animationRef = useRef(null);

  const geocache = useRef(new Map());
  const resolvedIncidents = useRef(new Map());
  const geocodeQueue = useRef([]);
  const isGeocoding = useRef(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  const [showCoverage, setShowCoverage] = useState(false);

  // 1. Map Initialization
  useEffect(() => {
    if (!mapInstance.current && mapRef.current && !mapRef.current._leaflet_id) {
      mapInstance.current = L.map(mapRef.current).setView([28.6139, 77.2090], 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(mapInstance.current);

      // Add Depot Markers
      DEPOTS.forEach(depot => {
        const iconHtml = `<div style="background-color: #4b5563; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px;">🏢</div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [20, 20], iconAnchor: [10, 10] });
        const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
        marker.bindPopup(`<b>${depot.name}</b><br/>Emergency Resource Base`);
        markersRef.current.depots.push(marker);
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 2. Geocoding Queue Processor
  const processGeocodeQueue = async () => {
    if (isGeocoding.current || geocodeQueue.current.length === 0) return;
    isGeocoding.current = true;
    
    while (geocodeQueue.current.length > 0) {
      const { id, locString } = geocodeQueue.current.shift();
      
      if (!locString) continue;
      
      if (geocache.current.has(locString)) {
        resolvedIncidents.current.set(id, geocache.current.get(locString));
        setForceUpdate(v => v + 1);
        continue;
      }
      
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locString)},Delhi&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          geocache.current.set(locString, coords);
          resolvedIncidents.current.set(id, coords);
        } else {
          // fallback jitter around center if not found
          const center = { lat: 28.6139 + (Math.random() * 0.1 - 0.05), lng: 77.2090 + (Math.random() * 0.1 - 0.05) };
          geocache.current.set(locString, center);
          resolvedIncidents.current.set(id, center);
        }
        setForceUpdate(v => v + 1);
      } catch (err) {
        console.error('Geocoding error', err);
      }
      
      // 1 request per second to respect Nominatim limits
      await new Promise(r => setTimeout(r, 1000));
    }
    isGeocoding.current = false;
  };

  // 3. Incident Marker Rendering
  useEffect(() => {
    if (!mapInstance.current) return;

    // Queue new incidents for geocoding
    incidents.forEach(incident => {
      if (incident.dispatch_status === 'completed' || incident.dispatch_status === 'merged_duplicate') return;
      
      const locString = incident.location?.raw_text;
      if (locString && !resolvedIncidents.current.has(incident.incident_id)) {
        if (!geocodeQueue.current.some(q => q.id === incident.incident_id)) {
          geocodeQueue.current.push({ id: incident.incident_id, locString });
        }
      }
    });
    processGeocodeQueue();

    const colorMap = { P1: '#ef4444', P2: '#ef4444', P3: '#f97316', P4: '#3b82f6', P5: '#3b82f6' };

    // Clear old incident markers
    Object.values(markersRef.current.incidents).forEach(marker => mapInstance.current.removeLayer(marker));
    markersRef.current.incidents = {};

    incidents.forEach(incident => {
      if (incident.dispatch_status === 'completed' || incident.dispatch_status === 'merged_duplicate') return;
      
      const coords = resolvedIncidents.current.get(incident.incident_id);
      if (!coords) return;

      const isCritical = incident.priority === 'P1' || incident.priority === 'P2';
      
      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: isCritical ? 14 : 10,
        fillColor: colorMap[incident.priority] || '#3b82f6',
        color: '#fff',
        weight: isCritical ? 3 : 2,
        opacity: 1,
        fillOpacity: isCritical ? 0.9 : 0.7,
        className: isCritical ? 'pulse-marker' : ''
      }).addTo(mapInstance.current);

      const category = incident.incident_type?.category || 'Unknown';
      const vicCount = incident.victim_count || 'Unknown';
      const eta = incident.assigned_resources?.[0]?.eta_minutes;

      marker.bindPopup(`
        <div style="min-width: 200px; padding: 4px; color: #000; font-family: sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="color: ${colorMap[incident.priority]}; font-size: 16px;">${incident.priority}</strong>
            <span style="font-size: 12px; font-weight: bold; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${incident.dispatch_status.toUpperCase()}</span>
          </div>
          <div style="font-size: 13px; line-height: 1.6;">
            <strong>Category:</strong> ${category.replace('_', ' ')}<br/>
            <strong>Victims:</strong> ${vicCount}<br/>
            ${eta ? `<strong>Best ETA:</strong> ${eta} mins` : '<strong>ETA:</strong> Pending'}
          </div>
        </div>
      `);

      markersRef.current.incidents[incident.incident_id] = marker;
    });

  }, [incidents, forceUpdate]);

  // 4. Resource Animation
  const animateResources = () => {
    const now = Date.now();
    const DURATION = 10000; // 10 seconds to reach target

    resourceState.current.forEach((resData, key) => {
      if (resData.isAnimating) {
        const elapsed = now - resData.startTime;
        let progress = elapsed / DURATION;
        
        if (progress >= 1) {
          progress = 1;
          resData.isAnimating = false; // Arrived
        }
        
        // Easing function (easeOutQuad)
        const ease = progress * (2 - progress);
        
        const currentLat = resData.startLat + (resData.targetLat - resData.startLat) * ease;
        const currentLng = resData.startLng + (resData.targetLng - resData.startLng) * ease;
        
        resData.marker.setLatLng([currentLat, currentLng]);
      }
    });

    animationRef.current = requestAnimationFrame(animateResources);
  };

  useEffect(() => {
    if (!mapInstance.current) return;

    const currentResourceIds = new Set();

    resources.forEach(resource => {
      const key = resource.id;
      currentResourceIds.add(key);

      // We need a destination. It's tied to an incident location string.
      const targetLocString = resource.location; 
      let targetCoords = targetLocString ? geocache.current.get(targetLocString) : null;
      
      // If we don't have coords yet but we have the string, use a fallback center for now to spawn them
      if (!targetCoords && targetLocString) {
          targetCoords = { lat: 28.6139, lng: 77.2090 };
      }

      if (targetCoords) {
        if (!resourceState.current.has(key)) {
          // New resource! Assign to a random depot
          const depot = DEPOTS[Math.floor(Math.random() * DEPOTS.length)];
          
          // Create Icon
          const emoji = resource.type?.includes('ambulance') ? '🚑' : resource.type?.includes('fire') ? '🚒' : '🚓';
          const iconHtml = `
            <div style="background-color: #3b82f6; width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 14px;">
              ${emoji}
            </div>
          `;
          const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] });
          
          const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
          
          resourceState.current.set(key, {
            marker,
            startLat: depot.lat,
            startLng: depot.lng,
            targetLat: targetCoords.lat,
            targetLng: targetCoords.lng,
            startTime: Date.now(),
            isAnimating: true
          });
        } else {
          // Existing resource - update target if it moved
          const resData = resourceState.current.get(key);
          if (resData.targetLat !== targetCoords.lat || resData.targetLng !== targetCoords.lng) {
             const currentPos = resData.marker.getLatLng();
             resData.startLat = currentPos.lat;
             resData.startLng = currentPos.lng;
             resData.targetLat = targetCoords.lat;
             resData.targetLng = targetCoords.lng;
             resData.startTime = Date.now();
             resData.isAnimating = true;
          }
        }
      }
    });

    // Cleanup resources that are no longer active
    resourceState.current.forEach((resData, key) => {
      if (!currentResourceIds.has(key)) {
        mapInstance.current.removeLayer(resData.marker);
        resourceState.current.delete(key);
      }
    });

    // Start animation loop if not running
    if (!animationRef.current) {
      animationRef.current = requestAnimationFrame(animateResources);
    }
  }, [resources, forceUpdate]);

  // 5. Coverage Radius Toggle
  useEffect(() => {
    if (!mapInstance.current) return;
    
    // Clear old coverage
    markersRef.current.coverage.forEach(layer => mapInstance.current.removeLayer(layer));
    markersRef.current.coverage = [];

    if (showCoverage) {
      DEPOTS.forEach(depot => {
        const circle = L.circle([depot.lat, depot.lng], {
          radius: 3000, // 3km in meters
          color: '#3b82f6',
          weight: 1,
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          dashArray: '5, 5'
        }).addTo(mapInstance.current);
        markersRef.current.coverage.push(circle);
      });
    }
  }, [showCoverage]);

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col shadow-2xl relative" style={{ height: '60vh' }}>
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span className="text-2xl">🗺️</span> 
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Live Operational Grid
        </span>
        <button 
          onClick={() => setShowCoverage(!showCoverage)}
          className={`ml-auto text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${showCoverage ? 'bg-blue-500/30 border-blue-400 text-blue-300' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
        >
          <Layers size={12} /> Coverage Radius
        </button>
      </h2>
      
      <div ref={mapRef} className="flex-1 rounded-lg border border-gray-700 overflow-hidden relative z-0"></div>
      
      {/* Map Legend */}
      <div className="absolute bottom-6 left-6 bg-[#0D1B2A]/90 border border-gray-700 p-3 rounded-lg shadow-xl z-10 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-1">Legend</h4>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> <span className="text-gray-300">P1/P2 (Critical)</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div> <span className="text-gray-300">P3 (Serious)</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> <span className="text-gray-300">P4/P5 (Minor)</span></div>
          <div className="w-full h-px bg-gray-700 my-0.5"></div>
          <div className="flex items-center gap-2"><span className="text-sm bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center border border-white">🚑</span> <span className="text-gray-300">Ambulance</span></div>
          <div className="flex items-center gap-2"><span className="text-sm bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center border border-white">🚒</span> <span className="text-gray-300">Fire Unit</span></div>
          <div className="flex items-center gap-2"><span className="text-sm bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center border border-white">🚓</span> <span className="text-gray-300">Police</span></div>
        </div>
      </div>
    </div>
  );
};

export default MapView;