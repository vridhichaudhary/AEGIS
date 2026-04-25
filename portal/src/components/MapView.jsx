import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapView = ({ incidents, resources }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({ incidents: {}, resources: {} });

  // Initialize map
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current).setView([28.5355, 77.3910], 11);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(mapInstance.current);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update incident markers
  useEffect(() => {
    if (!mapInstance.current) return;

    const colorMap = {
      P1: '#ef4444',  // Red
      P2: '#f97316',  // Orange
      P3: '#eab308',  // Yellow
      P4: '#22c55e',  // Green
      P5: '#6b7280'   // Gray
    };

    // Remove old markers
    Object.values(markersRef.current.incidents).forEach(marker => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current.incidents = {};

    // Add current incidents
    incidents.forEach(incident => {
      const lat = incident.location?.latitude;
      const lon = incident.location?.longitude;
      
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

      const key = incident.incident_id;
      
      // Create pulsing marker for P1
      const isPriority = incident.priority === 'P1';
      
      const marker = L.circleMarker([lat, lon], {
        radius: isPriority ? 14 : 10,
        fillColor: colorMap[incident.priority] || '#3b82f6',
        color: '#fff',
        weight: isPriority ? 3 : 2,
        opacity: 1,
        fillOpacity: isPriority ? 0.9 : 0.7,
        className: isPriority ? 'pulse-marker' : ''
      }).addTo(mapInstance.current);

      const status = incident.dispatch_status || incident.status || 'pending';
      const category = incident.incident_type?.category || 'Unknown';
      const subcategory = incident.incident_type?.subcategory || '';

      marker.bindPopup(`
        <div style="min-width: 220px; padding: 4px; color: #000;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: ${colorMap[incident.priority]}; font-size: 18px; font-weight: bold;">
              ${incident.priority}
            </strong>
            <span style="background: ${colorMap[incident.priority]}20; color: ${colorMap[incident.priority]}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
              ${status.toUpperCase()}
            </span>
          </div>
          <div style="font-size: 13px; line-height: 1.6;">
            <strong>Type:</strong> ${category}${subcategory ? ` (${subcategory})` : ''}<br/>
            <strong>Location:</strong> ${incident.location?.raw_text || 'Unknown'}<br/>
            ${incident.assigned_resources?.length ? `<strong>Resources:</strong> ${incident.assigned_resources.length} dispatched<br/>` : ''}
            ${incident.assigned_resources?.[0]?.eta_minutes ? `<strong>ETA:</strong> ${incident.assigned_resources[0].eta_minutes} min<br/>` : ''}
          </div>
          <div style="font-size: 10px; color: #666; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd;">
            ID: ${incident.incident_id.slice(0, 8)}...
          </div>
        </div>
      `, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      markersRef.current.incidents[key] = marker;
    });
  }, [incidents]);

  // Update resource markers
  useEffect(() => {
    if (!mapInstance.current) return;

    const statusColors = {
      available: '#22c55e',
      dispatched: '#3b82f6',
      on_scene: '#ef4444',
      at_scene: '#ef4444'
    };

    // Remove old resource markers
    Object.values(markersRef.current.resources).forEach(marker => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current.resources = {};

    resources.forEach(resource => {
      const lat = resource.location?.latitude;
      const lon = resource.location?.longitude;
      
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

      const key = resource.id || resource.resource_id || resource.name;
      
      // Create custom icon for resources
      const iconHtml = `
        <div style="
          background-color: ${statusColors[resource.status] || '#3b82f6'};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        ">
          ${resource.type?.includes('ambulance') ? '🚑' : resource.type?.includes('fire') ? '🚒' : '🚓'}
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-resource-icon',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lon], { icon }).addTo(mapInstance.current);

      marker.bindPopup(`
        <div style="color: #000; min-width: 180px;">
          <strong style="font-size: 14px;">${key}</strong><br/>
          <strong>Type:</strong> ${resource.type?.replace('_', ' ') || 'Vehicle'}<br/>
          <strong>Status:</strong> <span style="color: ${statusColors[resource.status]}; font-weight: 600;">${resource.status?.toUpperCase() || 'UNKNOWN'}</span><br/>
          ${resource.base ? `<strong>Base:</strong> ${resource.base}<br/>` : ''}
        </div>
      `);

      markersRef.current.resources[key] = marker;
    });
  }, [resources]);

  return (
    <div className="glass-card rounded-xl p-4 h-96 flex flex-col shadow-2xl">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span className="text-2xl">🗺️</span> 
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Live Incident Map
        </span>
        <span className="ml-auto text-xs bg-blue-500/20 px-2 py-1 rounded-full">
          {incidents.length} Active
        </span>
      </h2>
      <div ref={mapRef} className="flex-1 rounded-lg border-2 border-blue-500/30"></div>
    </div>
  );
};

export default MapView;