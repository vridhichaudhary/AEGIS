import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Map as MapIcon, Target, Navigation } from 'lucide-react';

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
      mapInstance.current = L.map(mapRef.current, { zoomControl: false }).setView([28.6139, 77.2090], 12);
      
      L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 18,
      }).addTo(mapInstance.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

      // Add Depot Markers
      DEPOTS.forEach(depot => {
        const iconHtml = `<div style="background-color: #0A0F1A; width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 11px; box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);">${depot.icon}</div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
        const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
        marker.bindPopup(`<div class="mono text-[10px] font-bold text-aegis-info">${depot.name}</div><div class="text-[9px] text-aegis-text-muted">OPERATIONAL BASE</div>`);
        markersRef.current.depots.push(marker);
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
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

    const colorMap = { P1: '#EF4444', P2: '#F97316', P3: '#EAB308', P4: '#22C55E', P5: '#3B82F6' };
    Object.values(markersRef.current.incidents).forEach(marker => mapInstance.current.removeLayer(marker));
    markersRef.current.incidents = {};

    incidents.forEach(incident => {
      if (incident.dispatch_status === 'completed' || incident.dispatch_status === 'merged_duplicate' || incident.incident_status === 'RESOLVED') return;
      const coords = resolvedIncidents.current.get(incident.incident_id);
      if (!coords) return;

      const isCritical = incident.priority === 'P1' || incident.priority === 'P2';
      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: isCritical ? 12 : 8,
        fillColor: colorMap[incident.priority] || '#3B82F6',
        color: '#FFFFFF',
        weight: isCritical ? 2 : 1,
        opacity: 1,
        fillOpacity: 0.8,
        className: isCritical ? 'pulse-marker' : ''
      }).addTo(mapInstance.current);

      marker.bindPopup(`
        <div class="p-1 min-w-[160px]">
          <div class="flex justify-between items-center mb-2 pb-1 border-b border-aegis-border">
            <span class="badge ${incident.priority === 'P1' ? 'badge-critical' : incident.priority === 'P2' ? 'badge-warning' : 'badge-info'} text-[10px]">${incident.priority}</span>
            <span class="mono text-[9px] font-bold text-aegis-text-muted">${incident.dispatch_status.toUpperCase()}</span>
          </div>
          <div class="text-[11px] leading-relaxed text-aegis-text-primary">
            <div class="font-bold mb-1">${incident.incident_type?.category?.replace('_', ' ') || 'EMERGENCY'}</div>
            <div class="text-aegis-text-secondary">${incident.location?.raw_text || 'LOCATION UNKNOWN'}</div>
            ${incident.assigned_resources?.[0]?.eta_minutes ? `<div class="mt-2 text-aegis-info font-bold mono">ETA: ${incident.assigned_resources[0].eta_minutes} MIN</div>` : ''}
          </div>
        </div>
      `);
      markersRef.current.incidents[incident.incident_id] = marker;
    });
  }, [incidents, forceUpdate]);

  // 4. Resource Animation
  const animateResources = () => {
    const TRAVEL_SPEED = 0.0001;
    resourceState.current.forEach((resData) => {
      if (resData.isAnimating && resData.path && resData.path.length > 0) {
        resData.progress += TRAVEL_SPEED;
        if (resData.progress >= 1) {
          resData.progress = 1;
          resData.isAnimating = false;
        }
        const totalPoints = resData.path.length;
        const index = Math.floor(resData.progress * (totalPoints - 1));
        const nextIndex = Math.min(index + 1, totalPoints - 1);
        const subProgress = (resData.progress * (totalPoints - 1)) - index;
        const p1 = resData.path[index];
        const p2 = resData.path[nextIndex];
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
          const depotType = resource.type?.includes('ambulance') ? 'ambulance' : resource.type?.includes('fire') ? 'fire' : resource.type?.includes('police') ? 'police' : 'rescue';
          const depot = DEPOTS.find(d => d.id === depotType) || DEPOTS[2];
          
          const emoji = resource.type?.includes('ambulance') ? '🚑' : resource.type?.includes('fire') ? '🚒' : '🚓';
          const iconHtml = `<div style="background-color: #3b82f6; width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 13px;">${emoji}</div>`;
          const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] });
          const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
          
          let polyline = null;
          if (resource.route_geometry && resource.route_geometry.length > 0 && showRoutes) {
            const latLngs = resource.route_geometry.map(p => [p[1], p[0]]);
            polyline = L.polyline(latLngs, { color: '#3b82f6', weight: 2, opacity: 0.5, dashArray: '5, 8' }).addTo(mapInstance.current);
            markersRef.current.routes[key] = polyline;
          }

          resourceState.current.set(key, { marker, polyline, path: resource.route_geometry || [], progress: 0, isAnimating: true });
        }
      }
    });

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
    markersRef.current.coverage.forEach(layer => mapInstance.current.removeLayer(layer));
    markersRef.current.coverage = [];
    if (showCoverage) {
      DEPOTS.forEach(depot => {
        const circle = L.circle([depot.lat, depot.lng], { radius: 4000, color: '#3B82F6', weight: 1, fillOpacity: 0.05, dashArray: '4, 6' }).addTo(mapInstance.current);
        markersRef.current.coverage.push(circle);
      });
    }
    Object.keys(markersRef.current.routes).forEach(key => {
      if (!showRoutes) mapInstance.current.removeLayer(markersRef.current.routes[key]);
      else markersRef.current.routes[key].addTo(mapInstance.current);
    });
  }, [showCoverage, showRoutes]);

  return (
    <div className="card-flush flex flex-col h-full bg-aegis-bg-surface overflow-hidden relative" style={{ height: '62vh' }}>
      <div className="section-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MapIcon size={14} className="text-aegis-info" />
          <span>Operational GIS View</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowRoutes(!showRoutes)}
            className={`btn btn-xs ${showRoutes ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Navigation size={10} className="mr-1" /> Routes
          </button>
          <button 
            onClick={() => setShowCoverage(!showCoverage)}
            className={`btn btn-xs ${showCoverage ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Target size={10} className="mr-1" /> Coverage
          </button>
        </div>
      </div>
      
      <div ref={mapRef} className="flex-1 bg-aegis-bg-base relative z-0"></div>
      
      {/* Tactical Legend */}
      <div className="absolute bottom-6 left-6 bg-aegis-bg-elevated/90 border border-aegis-border p-3 rounded shadow-2xl z-10 backdrop-blur-md min-w-[140px]">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-aegis-border pb-1.5 mb-0.5">
            <span className="text-[9px] font-bold text-aegis-text-muted uppercase tracking-widest">Map Legend</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot-offline"></span> 
            <span className="text-[10px] text-aegis-text-secondary mono font-bold">CRITICAL (P1/P2)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot-warning"></span> 
            <span className="text-[10px] text-aegis-text-secondary mono font-bold">SERIOUS (P3)</span>
          </div>
          <div className="divider my-0"></div>
          <div className="flex items-center gap-2"><span className="text-xs">🚑</span> <span className="text-[10px] text-aegis-text-secondary font-bold">AMBULANCE</span></div>
          <div className="flex items-center gap-2"><span className="text-xs">🚒</span> <span className="text-[10px] text-aegis-text-secondary font-bold">FIRE UNIT</span></div>
          <div className="flex items-center gap-2"><span className="text-xs">🚓</span> <span className="text-[10px] text-aegis-text-secondary font-bold">POLICE UNIT</span></div>
        </div>
      </div>
    </div>
  );
};

export default MapView;