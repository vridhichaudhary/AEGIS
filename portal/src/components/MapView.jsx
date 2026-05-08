import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, ZoomIn, ZoomOut } from 'lucide-react';

// Fix Leaflet default icon issues for production builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getPreferredDepotTypes = (category = 'other') => {
  const typePreference = {
    accident: ['ambulance', 'police', 'fire'],
    medical: ['ambulance', 'hospital', 'police'],
    fire: ['fire', 'ambulance', 'police'],
    violence: ['police', 'ambulance', 'fire'],
    natural_disaster: ['rescue', 'fire', 'ambulance'],
  };

  return typePreference[category] || ['ambulance', 'police', 'fire'];
};

const getNearestRelevantDepots = (incident, depots = [], limit = 2) => {
  if (!incident?.location?.latitude || !incident?.location?.longitude) return [];

  const preferred = getPreferredDepotTypes(incident?.incident_type?.category);
  return depots
    .map((depot) => ({
      depot,
      distance: haversineDistance(
        incident.location.latitude,
        incident.location.longitude,
        depot.lat,
        depot.lng
      ),
      order: preferred.indexOf(depot.type) >= 0 ? preferred.indexOf(depot.type) : 99,
    }))
    .sort((a, b) => a.order !== b.order ? a.order - b.order : a.distance - b.distance)
    .slice(0, limit);
};

const MapView = ({ incidents = [], resources = [], depots = [], focusOn = null }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({ street: null, satellite: null });
  const markersRef = useRef({ incidents: {}, resources: {}, depots: {}, polylines: {} });
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

  // Sync Incidents and Dispatch Lines
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;

    // Clear old incident markers and polylines
    Object.values(markersRef.current.incidents).forEach(m => mapInstance.current.removeLayer(m));
    Object.values(markersRef.current.polylines).forEach(p => mapInstance.current.removeLayer(p));
    markersRef.current.incidents = {};
    markersRef.current.polylines = {};

    const colorMap = { P1: '#c96f5d', P2: '#d38b5d', P3: '#b88a4a', P4: '#2f8a72', P5: '#4f88c4' };

    incidents.forEach(inc => {
      if (inc.status === 'RESOLVED' || !inc.location?.latitude) return;

      const incPos = [inc.location.latitude, inc.location.longitude];
      const isCritical = inc.priority === 'P1' || inc.priority === 'P2';
      
      let hasAssignedDispatchLine = false;

      // Draw lines to assigned resources
      if (inc.assigned_resources) {
        inc.assigned_resources.forEach((res, idx) => {
          if (res.depot_lat && res.depot_lng) {
            const depotPos = [res.depot_lat, res.depot_lng];
            const poly = L.polyline([depotPos, incPos], {
              color: colorMap[inc.priority] || '#3182CE',
              weight: 2.5,
              dashArray: '6, 10',
              opacity: 0.72,
            }).addTo(mapInstance.current);
            markersRef.current.polylines[`${inc.incident_id}_res_${idx}`] = poly;
            hasAssignedDispatchLine = true;
          }
        });
      }

      // If a dispatch route has not been assigned yet, show nearest recommended corridor.
      if (!hasAssignedDispatchLine) {
        const nearestDepots = getNearestRelevantDepots(inc, depots, 2);
        nearestDepots.forEach(({ depot }, idx) => {
          const corridor = L.polyline([[depot.lat, depot.lng], incPos], {
            color: idx === 0 ? '#3b6ea8' : '#8aa9cc',
            weight: idx === 0 ? 2.25 : 1.75,
            dashArray: idx === 0 ? '5, 8' : '3, 8',
            opacity: idx === 0 ? 0.55 : 0.35,
            className: 'map-response-corridor',
          }).addTo(mapInstance.current);
          markersRef.current.polylines[`${inc.incident_id}_corridor_${depot.id}_${idx}`] = corridor;
        });
      }

      // Draw line to destination hospital if any
      if (inc.destination_hospital && inc.destination_hospital.lat && inc.destination_hospital.lng) {
          const hospPos = [inc.destination_hospital.lat, inc.destination_hospital.lng];
          const poly = L.polyline([incPos, hospPos], {
            color: '#3b6ea8',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.65,
          }).addTo(mapInstance.current);
          markersRef.current.polylines[`${inc.incident_id}_hosp`] = poly;
      }

      const marker = L.circleMarker(incPos, {
        radius: isCritical ? 12 : 8,
        fillColor: colorMap[inc.priority] || '#718096',
        color: '#FFFFFF',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(mapInstance.current);

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
  }, [incidents, depots, isMapReady]);

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
          <div className="flex items-center gap-2"><div className="w-4 h-[1px] bg-[#3b6ea8] border-t border-dashed"/> <span className="text-[10px] font-bold">Dispatch / nearest corridor</span></div>
        </div>
      </div>
    </div>
  );
};



export default MapView;
