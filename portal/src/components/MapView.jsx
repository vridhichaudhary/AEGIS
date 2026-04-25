import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Map as MapIcon } from 'lucide-react';

// Fix Leaflet default icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Real resource depot coordinates from DispatchAgent
const DEPOTS = [
  { id: 'ambulance', lat: 28.6328, lng: 77.2197, name: 'AIIMS Emergency Base', icon: '🏥' },
  { id: 'fire', lat: 28.6562, lng: 77.2410, name: 'Delhi Fire Station North', icon: '🚒' },
  { id: 'police', lat: 28.6139, lng: 77.2090, name: 'Delhi Police HQ', icon: '👮' },
  { id: 'rescue', lat: 28.5672, lng: 77.3210, name: 'NDRF Base Camp', icon: '🚁' },
];

const MapView = ({ incidents, resources }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  
  const markersRef = useRef({ incidents: {}, resources: {}, depots: [], coverage: [], routes: {} });
  const resourceState = useRef(new Map());
  const animationRef = useRef(null);

  const geocache = useRef(new Map());
  const resolvedIncidents = useRef(new Map());
  const geocodeQueue = useRef([]);
  const isGeocoding = useRef(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  const [showCoverage, setShowCoverage] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);

  // 1. Map Initialization
  useEffect(() => {
    if (!mapInstance.current && mapRef.current && !mapRef.current._leaflet_id) {
      mapInstance.current = L.map(mapRef.current).setView([28.6139, 77.2090], 12);
      
      L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 18,
      }).addTo(mapInstance.current);

      // Add Depot Markers
      DEPOTS.forEach(depot => {
        const iconHtml = `<div style="background-color: #1e293b; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);">${depot.icon}</div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
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
          const center = { lat: 28.6139 + (Math.random() * 0.1 - 0.05), lng: 77.2090 + (Math.random() * 0.1 - 0.05) };
          geocache.current.set(locString, center);
          resolvedIncidents.current.set(id, center);
        }
        setForceUpdate(v => v + 1);
      } catch (err) {
        console.error('Geocoding error', err);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    isGeocoding.current = false;
  };

  // 3. Incident Marker Rendering
  useEffect(() => {
    if (!mapInstance.current) return;
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
    Object.values(markersRef.current.incidents).forEach(marker => mapInstance.current.removeLayer(marker));
    markersRef.current.incidents = {};

    incidents.forEach(incident => {
      if (incident.dispatch_status === 'completed' || incident.dispatch_status === 'merged_duplicate' || incident.incident_status === 'RESOLVED') return;
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

      marker.bindPopup(`
        <div style="min-width: 200px; padding: 4px; color: #000; font-family: sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="color: ${colorMap[incident.priority]}; font-size: 16px;">${incident.priority}</strong>
            <span style="font-size: 12px; font-weight: bold; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${incident.dispatch_status.toUpperCase()}</span>
          </div>
          <div style="font-size: 13px; line-height: 1.6;">
            <strong>Category:</strong> ${incident.incident_type?.category?.replace('_', ' ') || 'Unknown'}<br/>
            <strong>Status:</strong> ${incident.incident_status}<br/>
            ${incident.assigned_resources?.[0]?.eta_minutes ? `<strong>Best ETA:</strong> ${incident.assigned_resources[0].eta_minutes} mins` : ''}
          </div>
        </div>
      `);
      markersRef.current.incidents[incident.incident_id] = marker;
    });
  }, [incidents, forceUpdate]);

  // 4. Resource Animation along OSRM Routes
  const animateResources = () => {
    const now = Date.now();
    const TRAVEL_SPEED = 0.0001; // Progress increment per frame

    resourceState.current.forEach((resData, key) => {
      if (resData.isAnimating && resData.path && resData.path.length > 0) {
        resData.progress += TRAVEL_SPEED;
        if (resData.progress >= 1) {
          resData.progress = 1;
          resData.isAnimating = false;
        }

        // Find position along polyline path
        const totalPoints = resData.path.length;
        const index = Math.floor(resData.progress * (totalPoints - 1));
        const nextIndex = Math.min(index + 1, totalPoints - 1);
        const subProgress = (resData.progress * (totalPoints - 1)) - index;

        const p1 = resData.path[index];
        const p2 = resData.path[nextIndex];
        
        // p is [lng, lat] from GeoJSON
        const currentLat = p1[1] + (p2[1] - p1[1]) * subProgress;
        const currentLng = p1[0] + (p2[0] - p1[0]) * subProgress;
        
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

      if (resource.status === 'dispatched' || resource.status === 'returning') {
        if (!resourceState.current.has(key)) {
          // Initialize resource at its depot
          const depotType = resource.type?.includes('ambulance') ? 'ambulance' : resource.type?.includes('fire') ? 'fire' : resource.type?.includes('police') ? 'police' : 'rescue';
          const depot = DEPOTS.find(d => d.id === depotType) || DEPOTS[2];
          
          const emoji = resource.type?.includes('ambulance') ? '🚑' : resource.type?.includes('fire') ? '🚒' : '🚓';
          const iconHtml = `<div style="background-color: #3b82f6; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 14px;">${emoji}</div>`;
          const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [28, 28], iconAnchor: [14, 14] });
          const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
          
          // Draw route if provided
          let polyline = null;
          if (resource.route_geometry && resource.route_geometry.length > 0 && showRoutes) {
            // GeoJSON is [lng, lat], Leaflet is [lat, lng]
            const latLngs = resource.route_geometry.map(p => [p[1], p[0]]);
            polyline = L.polyline(latLngs, { color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '5, 10' }).addTo(mapInstance.current);
            markersRef.current.routes[key] = polyline;
          }

          resourceState.current.set(key, {
            marker,
            polyline,
            path: resource.route_geometry || [],
            progress: 0,
            isAnimating: true
          });
        }
      }
    });

    // Cleanup
    resourceState.current.forEach((resData, key) => {
      if (!currentResourceIds.has(key)) {
        mapInstance.current.removeLayer(resData.marker);
        if (resData.polyline) mapInstance.current.removeLayer(resData.polyline);
        resourceState.current.delete(key);
      }
    });

    if (!animationRef.current) animationRef.current = requestAnimationFrame(animateResources);
  }, [resources, showRoutes]);

  // Toggle Visibility
  useEffect(() => {
    if (!mapInstance.current) return;
    
    // Coverage
    markersRef.current.coverage.forEach(layer => mapInstance.current.removeLayer(layer));
    markersRef.current.coverage = [];
    if (showCoverage) {
      DEPOTS.forEach(depot => {
        const circle = L.circle([depot.lat, depot.lng], { radius: 4000, color: '#3b82f6', weight: 1, fillOpacity: 0.05, dashArray: '5, 5' }).addTo(mapInstance.current);
        markersRef.current.coverage.push(circle);
      });
    }

    // Routes
    Object.keys(markersRef.current.routes).forEach(key => {
      if (!showRoutes) mapInstance.current.removeLayer(markersRef.current.routes[key]);
      else markersRef.current.routes[key].addTo(mapInstance.current);
    });
  }, [showCoverage, showRoutes]);

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col shadow-2xl relative bg-[#0B1218]" style={{ height: '60vh' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2 text-blue-400 uppercase tracking-widest">
          <MapIcon size={18} /> Operational Routing Grid
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowRoutes(!showRoutes)}
            className={`text-[10px] px-3 py-1 rounded-md border font-bold uppercase tracking-wider transition-all ${showRoutes ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
          >
            Route Map
          </button>
          <button 
            onClick={() => setShowCoverage(!showCoverage)}
            className={`text-[10px] px-3 py-1 rounded-md border font-bold uppercase tracking-wider transition-all ${showCoverage ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
          >
            Coverage
          </button>
        </div>
      </div>
      
      <div ref={mapRef} className="flex-1 rounded-lg border border-gray-800 overflow-hidden relative z-0"></div>
      
      {/* Legend */}
      <div className="absolute bottom-8 left-8 bg-[#0D1B2A]/90 border border-gray-700/50 p-4 rounded-xl shadow-2xl z-10 backdrop-blur-md">
        <div className="flex flex-col gap-3 text-[10px]">
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div> <span className="text-gray-400 font-bold uppercase tracking-tighter">Critical P1/P2</span></div>
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div> <span className="text-gray-400 font-bold uppercase tracking-tighter">Serious P3</span></div>
          <div className="w-full h-px bg-gray-800"></div>
          <div className="flex items-center gap-3"><span className="text-sm">🚑</span> <span className="text-gray-400 font-bold uppercase tracking-tighter">Ambulance</span></div>
          <div className="flex items-center gap-3"><span className="text-sm">🚒</span> <span className="text-gray-400 font-bold uppercase tracking-tighter">Fire Unit</span></div>
          <div className="flex items-center gap-3"><span className="text-sm">🚓</span> <span className="text-gray-400 font-bold uppercase tracking-tighter">Police</span></div>
        </div>
      </div>
    </div>
  );
};

export default MapView;