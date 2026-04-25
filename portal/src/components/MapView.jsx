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

const MapView = ({ incidents = [], resources = [], focusOn = null }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({ street: null, satellite: null });
  const markersRef = useRef({ incidents: {}, resources: {}, depots: [] });
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [mapLayer, setMapLayer] = useState('street');

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      mapInstance.current = L.map(mapRef.current, { 
        zoomControl: false,
        attributionControl: false 
      }).setView([28.6139, 77.2090], 12);
      
      // Light Professional Tiles (Voyager)
      layersRef.current.street = L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(mapInstance.current);

      layersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
      });

      // Add Depot Markers
      DEPOTS.forEach(depot => {
        const iconHtml = `<div style="background-color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #2C7A7B; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">${depot.icon}</div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [28, 28], iconAnchor: [14, 14] });
        const marker = L.marker([depot.lat, depot.lng], { icon }).addTo(mapInstance.current);
        marker.bindPopup(`<div style="font-family: Inter; font-weight: 700; font-size: 11px; color: #1A202C;">${depot.name}</div>`);
        markersRef.current.depots.push(marker);
      });

      setIsMapReady(true);
      
      // Invalidate size after mount to fix grey tiles issue
      setTimeout(() => {
        mapInstance.current?.invalidateSize();
      }, 100);

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

  // Invalidate size when component dimensions change
  useEffect(() => {
    if (mapInstance.current && isMapReady) {
      const resizeObserver = new ResizeObserver(() => {
        mapInstance.current?.invalidateSize();
      });
      resizeObserver.observe(mapRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [isMapReady]);

  // Handle Focus
  useEffect(() => {
    if (mapInstance.current && focusOn && isMapReady) {
      mapInstance.current.flyTo([focusOn.lat, focusOn.lng], 15, { animate: true, duration: 1.5 });
    }
  }, [focusOn, isMapReady]);

  // Sync Incidents
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;

    // Clear old markers
    Object.values(markersRef.current.incidents).forEach(m => mapInstance.current.removeLayer(m));
    markersRef.current.incidents = {};

    const colorMap = { P1: '#C53030', P2: '#C05621', P3: '#B7791F', P4: '#2F855A', P5: '#2B6CB0' };

    incidents.forEach(inc => {
      if (inc.status === 'RESOLVED' || !inc.location?.latitude) return;

      const isCritical = inc.priority === 'P1' || inc.priority === 'P2';
      const marker = L.circleMarker([inc.location.latitude, inc.location.longitude], {
        radius: isCritical ? 10 : 7,
        fillColor: colorMap[inc.priority] || '#718096',
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(mapInstance.current);

      marker.bindPopup(`
        <div style="font-family: Inter; min-width: 140px;">
          <div style="font-weight: 800; font-size: 10px; color: ${colorMap[inc.priority]}; text-transform: uppercase; margin-bottom: 4px;">${inc.priority} Incident</div>
          <div style="font-size: 12px; font-weight: 600; color: #1A202C;">${inc.incident_type?.category?.replace('_', ' ') || 'Emergency'}</div>
          <div style="font-size: 11px; color: #4A5568; margin-top: 2px;">${inc.location?.raw_text || 'Active Site'}</div>
        </div>
      `);
      markersRef.current.incidents[inc.incident_id] = marker;
    });
  }, [incidents, isMapReady]);

  // Sync Resources
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;

    Object.values(markersRef.current.resources).forEach(m => mapInstance.current.removeLayer(m));
    markersRef.current.resources = {};

    resources.forEach(res => {
      if (res.status !== 'available' && res.location?.latitude) {
        const emoji = res.type?.includes('ambulance') ? '🚑' : res.type?.includes('fire') ? '🚒' : '🚓';
        const iconHtml = `<div style="background-color: white; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #2B6CB0; box-shadow: 0 4px 10px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 13px;">${emoji}</div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] });
        const marker = L.marker([res.location.latitude, res.location.longitude], { icon }).addTo(mapInstance.current);
        markersRef.current.resources[res.id] = marker;
      }
    });
  }, [resources, isMapReady]);

  // Layer Toggle
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

  if (mapError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
        <AlertTriangle size={48} className="text-amber-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Map Error</h3>
        <p className="text-sm text-slate-500 max-w-xs">{mapError}</p>
        <button onClick={() => window.location.reload()} className="mt-4 btn btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative group">
      <div ref={mapRef} className="h-full w-full z-0 bg-slate-100"></div>
      
      {!isMapReady && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
             <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
             <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">Initializing Map...</span>
          </div>
        </div>
      )}

      {/* Map Overlay Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-xl border border-slate-200 flex flex-col">
          <button onClick={() => mapInstance.current?.zoomIn()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ZoomIn size={18} />
          </button>
          <div className="h-[1px] bg-slate-100 mx-2" />
          <button onClick={() => mapInstance.current?.zoomOut()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ZoomOut size={18} />
          </button>
        </div>

        <button 
          onClick={() => setMapLayer(mapLayer === 'street' ? 'satellite' : 'street')}
          className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-xl border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors"
        >
          <Layers size={14} />
          {mapLayer === 'street' ? 'Sat' : 'Map'}
        </button>
      </div>

      {/* Legend Container */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-200 min-w-[160px]">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Map Legend</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#C53030]" />
            <span className="text-[11px] font-bold text-slate-700">Critical (P1)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#B7791F]" />
            <span className="text-[11px] font-bold text-slate-700">Serious (P3)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 border border-blue-500 text-[10px]">🚑</div>
            <span className="text-[11px] font-bold text-slate-700">Active Units</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;