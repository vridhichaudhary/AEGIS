import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Map as MapIcon, Target, Navigation, ZoomIn, ZoomOut } from 'lucide-react';

// Fix Leaflet default icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEPOTS = [
  { id: 'ambulance', lat: 28.6328, lng: 77.2197, name: 'AIIMS Emergency Base', icon: '🏥' },
  { id: 'fire', lat: 28.6562, lng: 77.2410, name: 'Delhi Fire Station North', icon: '🚒' },
  { id: 'police', lat: 28.6139, lng: 77.2090, name: 'Delhi Police HQ', icon: '👮' },
  { id: 'rescue', lat: 28.5672, lng: 77.3210, name: 'NDRF Base Camp', icon: '🚁' },
];

const MapView = ({ incidents = [], resources = [], focusOn = null }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({ street: null, satellite: null });
  
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
  const [mapLayer, setMapLayer] = useState('street');

  // Handle Focus
  useEffect(() => {
    if (mapInstance.current && focusOn) {
      mapInstance.current.flyTo([focusOn.lat, focusOn.lng], 15, { animate: true, duration: 1.5 });
    }
  }, [focusOn]);

  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current, { zoomControl: false }).setView([28.6139, 77.2090], 12);
      
      layersRef.current.street = L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 18,
      }).addTo(mapInstance.current);

      layersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 18,
      });

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

  // Layer Toggle
  useEffect(() => {
    if (!mapInstance.current) return;
    if (mapLayer === 'satellite') {
      mapInstance.current.removeLayer(layersRef.current.street);
      layersRef.current.satellite.addTo(mapInstance.current);
    } else {
      mapInstance.current.removeLayer(layersRef.current.satellite);
      layersRef.current.street.addTo(mapInstance.current);
    }
  }, [mapLayer]);

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

  useEffect(() => {
    if (!mapInstance.current) return;
    incidents.forEach(incident => {
      if (incident.dispatch_status === 'completed' || incident.dispatch_status === 'merged_duplicate' || incident.incident_status === 'RESOLVED') return;
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
          </div>
        </div>
      `);
      markersRef.current.incidents[incident.incident_id] = marker;
    });
  }, [incidents, forceUpdate]);

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
  }, [showCoverage]);

  return (
    <div className="h-full w-full relative flex flex-col overflow-hidden">
      {/* Map Header Controls */}
      <div className="section-header absolute top-0 left-0 right-0 z-20 flex justify-between items-center bg-aegis-bg-base/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <MapIcon size={14} className="text-aegis-info" />
          <span>Tactical GIS Command View</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMapLayer(mapLayer === 'street' ? 'satellite' : 'street')} className="btn btn-xs btn-ghost">
            <Layers size={10} className="mr-1" /> {mapLayer === 'street' ? 'Satellite' : 'Street'}
          </button>
          <button onClick={() => setShowCoverage(!showCoverage)} className={`btn btn-xs ${showCoverage ? 'btn-primary' : 'btn-ghost'}`}>
            <Target size={10} className="mr-1" /> Coverage
          </button>
        </div>
      </div>

      <div ref={mapRef} className="flex-1 z-0"></div>

      {/* Floating Zoom Controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <button onClick={() => mapInstance.current?.zoomIn()} className="btn btn-ghost bg-aegis-bg-surface/80 p-2 border-aegis-border shadow-xl backdrop-blur-md">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => mapInstance.current?.zoomOut()} className="btn btn-ghost bg-aegis-bg-surface/80 p-2 border-aegis-border shadow-xl backdrop-blur-md">
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Tactical Legend */}
      <div className="absolute bottom-6 left-6 bg-aegis-bg-elevated/90 border border-aegis-border p-3 rounded shadow-2xl z-10 backdrop-blur-md min-w-[120px]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><span className="status-dot status-dot-offline"></span><span className="text-[10px] mono font-bold">P1/P2 ALERT</span></div>
          <div className="flex items-center gap-2"><span className="status-dot status-dot-warning"></span><span className="text-[10px] mono font-bold">P3 SERIOUS</span></div>
          <div className="divider my-0.5"></div>
          <div className="flex items-center gap-2 text-[10px] font-bold"><span className="text-xs">🚑</span> AMBULANCE</div>
          <div className="flex items-center gap-2 text-[10px] font-bold"><span className="text-xs">🚒</span> FIRE UNIT</div>
        </div>
      </div>
    </div>
  );
};

export default MapView;