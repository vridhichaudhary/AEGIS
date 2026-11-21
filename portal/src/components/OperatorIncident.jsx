import React, { useState } from 'react';
import { locationSource } from './MapView';
import { dispatchLabel } from '../utils/incidentStatus';

const OperatorIncident = ({ incident, draftPin, picking, onPick, onClearPin, onUpdate, onReview, onClose, onResolve }) => {
  const [detail, setDetail] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async event => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await onUpdate(incident.incident_id, {
        additional_info: detail.trim(), location: draftPin,
      });
      setDetail('');
      onClearPin();
      if (result.requires_callback) setError('Location still needs confirmation. Try a specific landmark or select a pin.');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSaving(false);
    }
  };

  const review = async event => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onReview(incident.incident_id, category);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700" aria-label="Incident details">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">#{incident.incident_id.slice(0, 8).toUpperCase()} · {incident.priority}</p>
          <h3 className="mt-1 font-bold text-slate-900">{incident.status === 'RESOLVED' ? 'Resolved' : dispatchLabel(incident.dispatch_status)}</h3>
        </div>
        <button className="rounded border px-2 py-1 text-xs" onClick={onClose}>Close details</button>
      </div>
      <p className="mt-2 font-medium">{incident.location?.raw_text || 'Location pending'} · {locationSource(incident.location?.source)}</p>
      <p className="mt-2 whitespace-pre-wrap">{incident.transcript}</p>
      {incident.resource_shortfall?.length > 0 && (
        <p className="mt-2 text-amber-800">Unfilled requests · {incident.resource_shortfall.map(unit => `${unit.quantity} × ${unit.type.replaceAll('_', ' ')}`).join(', ')}</p>
      )}
      {incident.destination_hospital && (
        <p className="mt-2">Simulated receiving hospital · {incident.destination_hospital.name}</p>
      )}
      {incident.hospital_warning && <p className="mt-2 text-amber-800">{incident.hospital_warning}</p>}
      {incident.requires_callback && incident.dispatch_status === 'awaiting_location' && (
        <form className="mt-4 space-y-2 border-t pt-3" onSubmit={save}>
          <p>{incident.suggested_callback_script}</p>
          <label className="block font-medium">Callback details
            <input className="mt-1 block w-full rounded border px-2 py-2" value={detail} onChange={event => setDetail(event.target.value)} maxLength={2000} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={onPick} disabled={saving}>
              {picking ? 'Cancel map selection' : 'Select pin on map'}
            </button>
            <button className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50" disabled={saving || (!detail.trim() && !draftPin)}>
              {saving ? 'Saving…' : 'Update incident location'}
            </button>
          </div>
          {picking && <p role="status">Click the incident map to place a pin.</p>}
          {draftPin && <p>Selected · {draftPin.latitude.toFixed(5)}, {draftPin.longitude.toFixed(5)}</p>}
        </form>
      )}
      {incident.dispatch_status === 'review_required' && incident.status !== 'RESOLVED' && (
        <form className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3" onSubmit={review}>
          <label className="font-medium">Confirm incident category
            <select className="mt-1 block rounded border px-2 py-1" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">Choose a category</option>
              {['fire', 'medical', 'accident', 'natural_disaster', 'violence'].map(kind => (
                <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <button className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50" disabled={saving || !category}>Confirm for dispatch</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      <details className="mt-4 border-t pt-3">
        <summary className="cursor-pointer font-semibold">Decision timeline <span className="font-normal">({incident.agent_trail?.length || 0})</span></summary>
        <ol className="mt-2 max-h-56 space-y-2 overflow-auto">
          {(incident.agent_trail || []).map((event, index) => (
            <li key={index} className="border-l-2 border-slate-300 pl-2">
              <div className="font-medium capitalize">{event.agent} · {event.decision}</div>
              <div className="text-xs text-slate-600">{event.reasoning}</div>
            </li>
          ))}
        </ol>
      </details>
      {incident.status !== 'RESOLVED' && (
        <button className="mt-3 rounded border px-2 py-1 text-xs" onClick={() => onResolve(incident.incident_id)} disabled={saving}>
          Resolve incident
        </button>
      )}
    </section>
  );
};

export default OperatorIncident;
