import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapView = ({ incidents, resources }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({ incidents: {}, resources: {} });

  useEffect(() => {
    // Initialize map
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([28.6139, 77.2090], 11);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance.current);
    }
  }, []);

  useEffect(() => {
    // Update incident markers
    incidents.forEach(incident => {
      if (!incident.location?.latitude) return;

      const key = incident.incident_id;
      
      if (!markersRef.current.incidents[key]) {
        const color = {
          P1: 'red',
          P2: 'orange',
          P3: 'yellow',
          P4: 'green',
          P5: 'gray'
        }[incident.priority] || 'blue';

        const marker = L.circleMarker(
          [incident.location.latitude, incident.location.longitude],
          {
            radius: 10,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }
        ).addTo(mapInstance.current);

        marker.bindPopup(`
          <b>${incident.priority}</b><br/>
          ${incident.incident_type?.category}<br/>
          ${incident.location.raw_text}
        `);

        markersRef.current.incidents[key] = marker;
      }
    });
  }, [incidents]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-96">
      <h2 className="text-lg font-semibold mb-2">Live Incident Map</h2>
      <div ref={mapRef} className="h-80 rounded"></div>
    </div>
  );
};

export default MapView;