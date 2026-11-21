import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Maximize2 } from 'lucide-react';

const CENTER = [28.6139, 77.2090];
const COLORS = { P1: '#b93436', P2: '#c36526', P3: '#b48724', P4: '#27836d', P5: '#3975b4' };
const STREET = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const isPoint = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export const locationSource = source => ({
  shared_pin: 'Shared pin',
  operator_pin: 'Operator pin',
  gazetteer: 'Approximate landmark',
  legacy_unverified: 'Legacy location · unverified',
}[source] || 'Location pending');

const popup = (...lines) => {
  const box = document.createElement('div');
  lines.filter(Boolean).forEach((line, index) => {
    const row = document.createElement(index === 0 ? 'strong' : 'div');
    row.textContent = line;
    box.appendChild(row);
  });
  return box;
};

const active = incident => incident.status !== 'RESOLVED' &&
  incident.dispatch_status !== 'merged_duplicate' && !incident.is_duplicate;

const MapView = ({ incidents = [], depots = [], focusOn, compact = false, onPickPin, draftPin }) => {
  const container = useRef(null);
  const map = useRef(null);
  const bounds = useRef(null);
  const [layer, setLayer] = useState('street');
  const [tileError, setTileError] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [priority, setPriority] = useState('');
  const [showDepots, setShowDepots] = useState(!compact);

  useEffect(() => {
    let instance;
    let observer;
    try {
      instance = L.map(container.current).setView(CENTER, 11);
      map.current = instance;
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
    } catch (error) {
      console.error('Map initialization failed', error);
      setMapError(true);
    }
    return () => {
      observer?.disconnect();
      instance?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    setTileError(false);
    const tile = layer === 'street'
      ? L.tileLayer(STREET, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' })
      : L.tileLayer(SATELLITE, { maxNativeZoom: 18, maxZoom: 19, attribution: 'Tiles &copy; Esri' });
    tile.on('tileerror', () => setTileError(true)).addTo(instance);
    return () => tile.remove();
  }, [layer]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !onPickPin) return;
    const pick = ({ latlng }) => {
      const point = latlng.wrap();
      onPickPin({ latitude: point.lat, longitude: point.lng });
    };
    instance.on('click', pick);
    return () => instance.off('click', pick);
  }, [onPickPin]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isPoint(draftPin?.latitude, draftPin?.longitude)) return;
    const marker = L.circleMarker([draftPin.latitude, draftPin.longitude], {
      radius: 9, color: '#127d68', fillOpacity: 0.7,
    }).addTo(instance);
    return () => marker.remove();
  }, [draftPin]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const stations = L.layerGroup().addTo(instance);
    if (showDepots) {
      depots.filter(depot => isPoint(depot.lat, depot.lng)).forEach(depot => {
        const available = Object.values(depot.available || {}).reduce((total, count) => total + count, 0);
        L.circleMarker([depot.lat, depot.lng], {
          radius: 5, weight: 2, color: '#fff', fillColor: '#365971', fillOpacity: 0.85,
        }).bindPopup(popup(depot.name, `${available} simulated units available`)).addTo(stations);
      });
    }
    return () => stations.remove();
  }, [depots, showDepots]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const overlays = L.layerGroup().addTo(instance);
    const points = [];
    incidents.filter(active).filter(incident => !priority || incident.priority === priority).forEach(incident => {
      const { latitude, longitude, source, raw_text } = incident.location || {};
      if (!isPoint(latitude, longitude)) return;

      const position = [latitude, longitude];
      const color = COLORS[incident.priority] || '#718096';
      points.push(position);
      for (const unit of incident.assigned_resources || []) {
        const road = unit.route_source === 'osrm';
        const route = (unit.route_geometry || []).map(([lng, lat]) => [lat, lng]);
        if (route.length < 2 || !route.every(([lat, lng]) => isPoint(lat, lng))) continue;
        points.push(...route);
        L.polyline(route, { color, weight: 3, dashArray: road ? undefined : '5, 8', opacity: 0.8 })
          .bindPopup(popup(unit.resource_id, unit.depot_name, road ? 'OSRM road route' : 'Straight-line estimate',
            `${unit.distance_km} km · estimated ${unit.eta_minutes} min`))
          .addTo(overlays);
      }
      const hospital = incident.destination_hospital;
      if (hospital && isPoint(hospital.lat, hospital.lng)) {
        const destination = [hospital.lat, hospital.lng];
        points.push(destination);
        L.polyline([position, destination], { color: '#276da0', dashArray: '4, 7', weight: 2 })
          .bindPopup(popup(hospital.name, 'Simulated hospital · straight-line estimate')).addTo(overlays);
        L.circleMarker(destination, { radius: 6, color: '#276da0', fillColor: '#fff', fillOpacity: 1 })
          .bindPopup(popup(hospital.name, `${hospital.available_beds} simulated beds at assignment`)).addTo(overlays);
      }

      L.circleMarker(position, {
        radius: incident.priority === 'P1' ? 9 : 7, color: '#fff', weight: 3,
        fillColor: color, fillOpacity: 1,
      }).bindPopup(popup(
        `${incident.priority} · ${(incident.incident_type?.category || 'incident').replaceAll('_', ' ')}`,
        raw_text, locationSource(source),
        incident.merged_count > 1 ? `${incident.merged_count} linked reports` : '',
      )).addTo(overlays);
    });
    bounds.current = points.length ? L.latLngBounds(points) : null;
    if (compact && bounds.current) instance.fitBounds(bounds.current, { padding: [28, 28], maxZoom: 14 });
    return () => overlays.remove();
  }, [compact, incidents, priority]);

  useEffect(() => {
    if (isPoint(focusOn?.lat, focusOn?.lng)) map.current?.setView([focusOn.lat, focusOn.lng], 15);
  }, [focusOn]);

  const unmapped = incidents.filter(active).filter(incident =>
    !isPoint(incident.location?.latitude, incident.location?.longitude)).length;

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-slate-100 ${compact ? 'h-[260px]' : 'h-full min-h-[320px]'} ${onPickPin ? '[&_.leaflet-container]:cursor-crosshair' : ''}`}>
      <div ref={container} className="h-full w-full z-0" aria-label="Incident response map" />
      {mapError && <p className="absolute top-4 left-12 text-sm bg-white p-2" role="alert">Map could not initialize.</p>}
      {tileError && <p className="absolute left-12 top-3 z-10 bg-white px-2 py-1 rounded text-xs" role="status">Base map imagery unavailable</p>}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap justify-end gap-1">
        {!compact && (
          <>
            <select className="rounded border bg-white px-2 text-xs" aria-label="Filter map priority" value={priority} onChange={event => setPriority(event.target.value)}>
              <option value="">All priorities</option>
              {Object.keys(COLORS).map(value => <option key={value}>{value}</option>)}
            </select>
            <button className="rounded border bg-white px-2 text-xs" aria-pressed={showDepots} onClick={() => setShowDepots(value => !value)}>Depots</button>
          </>
        )}
        <button className="rounded border bg-white p-2" aria-label="Fit incident map" onClick={() => {
          if (bounds.current) map.current?.fitBounds(bounds.current, { padding: [28, 28], maxZoom: 14 });
          else map.current?.setView(CENTER, 11);
        }}><Maximize2 size={15} /></button>
        <button className="rounded border bg-white p-2" aria-label={layer === 'street' ? 'Show satellite map' : 'Show street map'} onClick={() => setLayer(layer === 'street' ? 'satellite' : 'street')}><Layers size={15} /></button>
      </div>
      <div className="absolute bottom-6 left-3 z-10 rounded-lg bg-white/95 p-2 text-[11px] text-slate-700 shadow">
        <div>Solid · road route</div>
        <div>Dashed · straight-line estimate</div>
        {!compact && unmapped > 0 && <div>{unmapped} reports without a mapped location</div>}
      </div>
    </div>
  );
};

export default MapView;
