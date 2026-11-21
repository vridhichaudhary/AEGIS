from __future__ import annotations

import asyncio
from collections import Counter
from datetime import datetime
from typing import List, Optional, Tuple

import aiohttp

from config.settings import settings
from state.hospitals import HOSPITALS, fleet_covers, assign_unit, find_nearest_available, haversine_distance, release_units


class DispatchAgent:
    """Assign available simulated units and report the provenance of each estimate."""

    async def get_osrm_eta(self, origin_lat, origin_lng, dest_lat, dest_lng):
        """Return a calibrated road estimate when the configured service responds."""
        url = (f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/"
               f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson")
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=4.0)) as s:
                async with s.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("routes"):
                            r = data["routes"][0]
                            coordinates = r["geometry"]["coordinates"]
                            if len(coordinates) < 2:
                                return None
                            return {
                                "eta_minutes": round(r["duration"] / 60, 1),
                                "distance_km": round(r["distance"] / 1000, 1),
                                "route_geometry": coordinates,
                                "route_source": "osrm",
                                "route_name": "OSRM Road Network",
                            }
        except Exception:
            pass
        return None

    async def release_resources(self, incident_id: str) -> List[str]:
        return release_units(incident_id)

    async def allocate_resources(self, incident_id: str, priority: str, requirements: List[dict], location: dict) -> List[dict]:
        assigned = []
        dest_lat = location.get("latitude")
        dest_lng = location.get("longitude")
        if dest_lat is None or dest_lng is None:
            return assigned

        for req in requirements:
            r_type = req["type"]
            quantity = req.get("quantity", 1)
            candidates = find_nearest_available(r_type, dest_lat, dest_lng)
            to_assign = candidates[:min(quantity, len(candidates))]
            for unit in to_assign:
                assign_unit(unit["resource_id"], incident_id, priority)
                assigned.append({
                    "resource_id": unit["resource_id"],
                    "resource_type": r_type,
                    "eta_minutes": unit["eta_minutes"],
                    "distance_km": unit["distance_km"],
                    "depot_name": unit["depot_name"],
                    "depot_lat": unit["depot_lat"],
                    "depot_lng": unit["depot_lng"],
                    "route_geometry": [[unit["depot_lng"], unit["depot_lat"]], [dest_lng, dest_lat]],
                    "route_name": "Straight-line estimate",
                    "route_source": "estimate",
                    "status": "dispatched",
                })
        if assigned and not settings.USE_MOCK_ROUTING:
            try:
                routes = await asyncio.gather(*(
                    self.get_osrm_eta(unit["depot_lat"], unit["depot_lng"], dest_lat, dest_lng)
                    for unit in assigned
                ))
            except asyncio.CancelledError:
                release_units(incident_id)
                raise
            for unit, route in zip(assigned, routes):
                if route:
                    unit.update(route)
        return assigned

    async def process(self, state: dict) -> dict:
        requirements = state["resource_requirements"]
        incident_location = state["location"]
        incident_id = state["incident_id"]
        priority = state["priority"]
        lat = (incident_location or {}).get("latitude")
        lng = (incident_location or {}).get("longitude")
        hold = None
        if state.get("is_duplicate"):
            hold = "merged_duplicate"
        elif priority == "P5":
            hold = "not_required"
        elif state.get("requires_callback") or lat is None or lng is None:
            hold = "awaiting_location"
        elif not fleet_covers(lat, lng):
            hold = "outside_service_area"
        elif not requirements or ("review_required" in state.get("validation_flags", []) and not state.get("human_override")):
            hold = "review_required"

        if hold:
            state["agent_trail"].append({
                "agent": "dispatch", "timestamp": datetime.now(),
                "decision": "Held", "reasoning": hold.replace("_", " "),
            })
            return {
                **state, "assigned_resources": [], "dispatch_status": hold,
                "incident_status": "PENDING_INFO" if hold == "awaiting_location" else "PENDING",
            }

        assigned_resources = await self.allocate_resources(incident_id, priority, requirements, incident_location)
        assigned_count = Counter(unit["resource_type"] for unit in assigned_resources)
        demand = Counter()
        for requirement in requirements:
            demand[requirement["type"]] += requirement["quantity"]
        shortfall = [{"type": kind, "quantity": count} for kind, count in (demand - assigned_count).items()]
        status = ("partially_assigned" if shortfall else "assigned") if assigned_resources else "resource_unavailable"
        inc_status = "DISPATCHED" if assigned_resources else "PENDING"

        dest_hospital = hospital_warning = None
        if any(unit["resource_type"].startswith("ambulance") for unit in assigned_resources):
            incident = state.get("incident_type") or {}
            specialty = {"accident": "trauma", "fire": "burn"}.get(incident.get("category"), "emergency")
            if incident.get("subcategory") == "cardiac_emergency":
                specialty = "cardiac"
            if incident.get("subcategory") == "obstetric_emergency":
                specialty = "obstetrics"
            dest_hospital, hospital_warning = self.select_destination_hospital(
                lat, lng, specialty,
            )

        reasoning_parts = []
        for res in assigned_resources:
            suffix = res["route_name"]
            part = f"{res['resource_type']} {res['resource_id']} ETA {res['eta_minutes']}m ({res['distance_km']}km {suffix})"
            reasoning_parts.append(part)
        
        reasoning = ", ".join(reasoning_parts) if assigned_resources else "No resources available."

        state["agent_trail"].append({
            "agent": "dispatch",
            "timestamp": datetime.now(),
            "decision": "Dispatched" if assigned_resources else "Delayed",
            "reasoning": reasoning,
        })

        return {
            **state,
            "assigned_resources": assigned_resources,
            "dispatch_status": status,
            "incident_status": inc_status,
            "dispatch_timestamp": datetime.now() if assigned_resources else None,
            "resource_shortfall": shortfall,
            "destination_hospital": dest_hospital,
            "hospital_warning": hospital_warning,
        }

    def select_destination_hospital(self, lat: float, lng: float, required_specialty: str) -> Tuple[Optional[dict], Optional[str]]:
        matching = [hospital for hospital in HOSPITALS if required_specialty in hospital["specialties"]]
        if required_specialty == "emergency":
            matching = HOSPITALS
        candidates = [
            (haversine_distance(lat, lng, hospital["lat"], hospital["lng"]), hospital)
            for hospital in matching if hospital["available"] > 0 and haversine_distance(lat, lng, hospital["lat"], hospital["lng"]) <= 65
        ]
        if not candidates:
            return None, f"No simulated hospital with available capacity for {required_specialty}."

        distance, hospital = min(candidates, key=lambda candidate: candidate[0])
        return {
            "name": hospital["name"], "lat": hospital["lat"], "lng": hospital["lng"],
            "distance_km": round(distance, 2), "available_beds": hospital["available"],
            "eta_to_hospital": round(distance / 40 * 60, 1), "eta_source": "estimate",
        }, None
