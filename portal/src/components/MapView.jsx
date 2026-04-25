import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Map as MapIcon, Target, Navigation, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';

// Fix Leaflet default icon issues for production builds
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
];

const MapView = ({ incidents = [], resources = [], depots = [], focusOn = null }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({ street: null, satellite: null });
  const markersRef = useRef({ incidents: {}, resources: {}, depots: {} });
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [mapLayer, setMapLayer] = useState('street');

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      const center = [28.6139, 77.2090]; // Delhi NCR Center
      mapInstance.current = L.map(mapRef.current, { 
        zoomControl: false,
        attributionControl: false 
      }).setView(center, 11);
      
      layersRef.current.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstance.current);

      layersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
      });

      setIsMapReady(true);
      
      setTimeout(() => {
        mapInstance.current?.invalidateSize();
      }, 200);

    } catch (err) {
      console.error("Map initialization failed", err);
      setMapError("Geospatial engine failed to initialize.");
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Sync Depots (Hospitals, Police, Fire)
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;

    // Clear old depots
    Object.values(markersRef.current.depots).forEach(m => mapInstance.current.removeLayer(m));
    markersRef.current.depots = {};

    depots.forEach(depot => {
      const type = depot.type;
      const color = type === 'hospital' || type === 'ambulance' ? '#2B6CB0' : type === 'fire' ? '#C05621' : '#553C9A';
      const emoji = type === 'hospital' || type === 'ambulance' ? '🏥' : type === 'fire' ? '🚒' : '👮';
      
      const iconHtml = `
        <div style="background-color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
          ${emoji}
        </div>
      `;
      const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [28, 28], iconAnchor: [14, 14] });
      const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
      
      marker.bindPopup(`
        <div style="font-family: Inter; padding: 4px;">
          <div style="font-weight: 800; font-size: 11px; color: ${color}; text-transform: uppercase;">${depot.type} STATION</div>
          <div style="font-weight: 700; font-size: 13px; color: #1A202C;">${depot.name}</div>
          <div style="margin-top: 4px; font-size: 10px; color: #4A5568;">
            Available: ${depot.available?.ambulances || depot.available?.fire_trucks || depot.available?.police_units || 0} units
          </div>
        </div>
      `);
      markersRef.current.depots[depot.id] = marker;
    });
  }, [depots, isMapReady]);

  // Sync Incidents
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;

    Object.values(markersRef.current.incidents).forEach(m => mapInstance.current.removeLayer(m));
    markersRef.current.incidents = {};

    const colorMap = { P1: '#E53E3E', P2: '#DD6B20', P3: '#D69E2E', P4: '#38A169', P5: '#3182CE' };

    incidents.forEach(inc => {
      if (inc.status === 'RESOLVED' || !inc.location?.latitude) return;

      const isCritical = inc.priority === 'P1' || inc.priority === 'P2';
      const marker = L.circleMarker([inc.location.latitude, inc.location.longitude], {
        radius: isCritical ? 12 : 8,
        fillColor: colorMap[inc.priority] || '#718096',
        color: '#FFFFFF',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(mapInstance.current);

      // Pulse animation for critical
      if (isCritical) {
        marker.getElement()?.classList.add('map-pulse-marker');
      }

      marker.bindPopup(`
        <div style="font-family: Inter; min-width: 160px; padding: 2px;">
          <div style="font-weight: 900; font-size: 10px; color: ${colorMap[inc.priority]}; text-transform: uppercase; letter-spacing: 0.05em;">${inc.priority} PRIORITY</div>
          <div style="font-size: 14px; font-weight: 800; color: #1A202C; margin: 2px 0;">${inc.incident_type?.category?.replace('_', ' ') || 'Emergency'}</div>
          <div style="font-size: 11px; color: #4A5568;">📍 ${inc.location?.raw_text || 'Active Site'}</div>
          ${inc.merged_count > 1 ? `<div style="margin-top: 6px; padding: 2px 6px; background: #FED7D7; color: #9B2C2C; border-radius: 4px; font-size: 10px; font-weight: 700;">DUPLICATE CALLS: ${inc.merged_count}</div>` : ''}
        </div>
      `);
      markersRef.current.incidents[inc.incident_id] = marker;
    });
  }, [incidents, isMapReady]);

  // Sync Resources (Active movement)
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;

    Object.values(markersRef.current.resources).forEach(m => mapInstance.current.removeLayer(m));
    markersRef.current.resources = {};

    resources.forEach(res => {
      if (res.status === 'dispatched' && res.location?.latitude) {
        const type = res.type || '';
        const emoji = type.includes('ambulance') ? '🚑' : type.includes('fire') ? '🚒' : '🚓';
        const iconHtml = `
          <div style="background-color: white; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #3182CE; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px; animation: bounce 1s infinite;">
            ${emoji}
          </div>
        `;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [30, 30], iconAnchor: [15, 15] });
        const marker = L.marker([res.location.latitude, res.location.longitude], { icon }).addTo(mapInstance.current);
        marker.bindPopup(`<b>UNIT ${res.id}</b><br>En route to incident`);
        markersRef.current.resources[res.id] = marker;
      }
    });
  }, [resources, isMapReady]);

  // Handle Resize & Layer Toggle
  useEffect(() => {
    if (mapInstance.current && isMapReady) {
      const resizeObserver = new ResizeObserver(() => mapInstance.current?.invalidateSize());
      resizeObserver.observe(mapRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [isMapReady]);

  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;
    if (mapLayer === 'satellite') {
      mapInstance.current.removeLayer(layersRef.current.street);
      layersRef.current.satellite.addTo(mapInstance.current);
    } else {
      mapInstance.current.removeLayer(layersRef.current.satellite);
      layersRef.current.street.addTo(mapInstance.current);
    }
  }, [mapLayer, isMapReady]);

  useEffect(() => {
    if (mapInstance.current && focusOn && isMapReady) {
      mapInstance.current.flyTo([focusOn.lat, focusOn.lng], 15, { animate: true, duration: 1.5 });
    }
  }, [focusOn, isMapReady]);

  return (
    <div className="h-full w-full relative overflow-hidden rounded-xl shadow-inner bg-slate-100">
      <div ref={mapRef} className="h-full w-full z-0"></div>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="flex flex-col bg-white/90 backdrop-blur shadow-lg rounded-lg overflow-hidden border border-slate-200">
          <button onClick={() => mapInstance.current?.zoomIn()} className="p-2 hover:bg-slate-100"><ZoomIn size={18}/></button>
          <button onClick={() => mapInstance.current?.zoomOut()} className="p-2 hover:bg-slate-100 border-t border-slate-100"><ZoomOut size={18}/></button>
        </div>
        <button 
          onClick={() => setMapLayer(mapLayer === 'street' ? 'satellite' : 'street')}
          className="bg-white/90 backdrop-blur shadow-lg rounded-lg p-2 border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
        >
          <Layers size={18} className="text-slate-700"/>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 min-w-[140px]">
        <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Live Response Map</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#E53E3E]"/> <span className="text-[10px] font-bold">P1 Life-Threat</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#D69E2E]"/> <span className="text-[10px] font-bold">P3 Moderate</span></div>
          <div className="flex items-center gap-2"><span>🏥</span> <span className="text-[10px] font-bold">Resources</span></div>
        </div>
      </div>
    </div>
  );
};


export default MapView;