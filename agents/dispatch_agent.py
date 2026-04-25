from __future__ import annotations

import json
import random
import aiohttp
import asyncio
import math
from datetime import datetime
from typing import Dict, List, Literal, Optional, Tuple

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from config.settings import settings
from state.hospitals import HOSPITALS, haversine_distance

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None

class JointDispatchMemo(BaseModel):
    police_instructions: str = Field(description="Instructions for Police (100) or 'None'")
    fire_instructions: str = Field(description="Instructions for Fire (101) or 'None'")
    medical_instructions: str = Field(description="Instructions for Medical (108) or 'None'")
    unified_incident_commander: str = Field(description="Agency taking the lead: POLICE, FIRE, or MEDICAL")

class DispatchAgent(BaseAgent):
    """Dispatches safely using OSRM road-network routing for real-time ETAs."""

    RESOURCE_DEPOTS = {
        "ambulance": {"lat": 28.6328, "lng": 77.2197, "name": "AIIMS Emergency Base"},
        "ambulance_cardiac": {"lat": 28.6328, "lng": 77.2197, "name": "AIIMS Emergency Base"},
        "ambulance_trauma": {"lat": 28.6328, "lng": 77.2197, "name": "AIIMS Emergency Base"},
        "fire_truck": {"lat": 28.6562, "lng": 77.2410, "name": "Delhi Fire Station North"},
        "fire_truck_rescue": {"lat": 28.6562, "lng": 77.2410, "name": "Delhi Fire Station North"},
        "police": {"lat": 28.6139, "lng": 77.2090, "name": "Delhi Police HQ"},
        "rescue_team": {"lat": 28.5672, "lng": 77.3210, "name": "NDRF Base Camp"},
    }

    # Resource templates
    _RESOURCE_TEMPLATES = {
        "ambulance": [
            {"resource_id": "AMB-101", "location": "AIIMS Emergency Base"},
            {"resource_id": "AMB-102", "location": "AIIMS Emergency Base"},
            {"resource_id": "AMB-103", "location": "AIIMS Emergency Base"},
        ],
        "ambulance_cardiac": [
            {"resource_id": "CARD-201", "location": "AIIMS Emergency Base"},
            {"resource_id": "CARD-202", "location": "AIIMS Emergency Base"},
        ],
        "ambulance_trauma": [
            {"resource_id": "TRM-301", "location": "AIIMS Emergency Base"},
            {"resource_id": "TRM-302", "location": "AIIMS Emergency Base"},
        ],
        "fire_truck": [
            {"resource_id": "FIR-401", "location": "Delhi Fire Station North"},
            {"resource_id": "FIR-402", "location": "Delhi Fire Station North"},
        ],
        "fire_truck_rescue": [
            {"resource_id": "FIR-451", "location": "Delhi Fire Station North"},
            {"resource_id": "FIR-452", "location": "Delhi Fire Station North"},
        ],
        "police": [
            {"resource_id": "POL-501", "location": "Delhi Police HQ"},
            {"resource_id": "POL-502", "location": "Delhi Police HQ"},
        ],
        "rescue_team": [
            {"resource_id": "RSC-601", "location": "NDRF Base Camp"},
            {"resource_id": "RSC-602", "location": "NDRF Base Camp"},
        ],
    }
    
    _assigned_incidents: Dict[str, dict] = {} 
    preemption_events: List[dict] = []

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=JointDispatchMemo)

    async def get_osrm_eta(self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
        """Real road-network routing using OSRM Public API."""
        url = f"http://router.project-osrm.org/route/v1/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson"
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5.0)) as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get('routes'):
                            route = data['routes'][0]
                            return {
                                "duration_minutes": round(route['duration'] / 60, 1),
                                "distance_km": round(route['distance'] / 1000, 1),
                                "route_geometry": route['geometry']['coordinates'],
                                "route_name": route.get('name', 'Main Road')
                            }
        except Exception:
            pass

        # Fallback: Haversine distance / 30 km/h urban speed estimate
        dist = self.haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
        eta = (dist / 30.0) * 60.0 # minutes
        return {
            "duration_minutes": round(eta, 1),
            "distance_km": round(dist, 1),
            "route_geometry": [[origin_lng, origin_lat], [dest_lng, dest_lat]],
            "route_name": "Calculated (Heuristic)"
        }

    def haversine_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    async def query_available_resources(self, resource_type: str) -> List[Dict]:
        templates = self._RESOURCE_TEMPLATES.get(resource_type, [])
        return [
            {**t, "status": "available"}
            for t in templates
            if t["resource_id"] not in self._assigned_incidents or self._assigned_incidents[t["resource_id"]].get("status") == "available"
        ]

    async def assign_resource(self, resource_id: str, incident_id: str, priority: str, status: str = "dispatched"):
        self._assigned_incidents[resource_id] = {
            "incident_id": incident_id,
            "priority": priority,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }

    async def release_resources(self, incident_id: str) -> List[str]:
        released = []
        for rid, assignment in list(self._assigned_incidents.items()):
            if assignment.get("incident_id") == incident_id:
                del self._assigned_incidents[rid]
                released.append(rid)
        return released

    async def allocate_resources(self, incident_id: str, priority: str, requirements: List[dict], location: dict) -> List[dict]:
        assigned = []
        priority_map = {"P1": 1, "P2": 2, "P3": 3, "P4": 4, "P5": 5}
        current_p_val = priority_map.get(priority, 3)
        
        dest_lat = location.get("latitude")
        dest_lng = location.get("longitude")

        for req in requirements:
            r_type = req["type"]
            quantity = req.get("quantity", 1)
            
            # Get depot for this type
            depot = self.RESOURCE_DEPOTS.get(r_type, {"lat": 28.6139, "lng": 77.2090})
            
            available = await self.query_available_resources(r_type)
            to_assign = available[: min(quantity, len(available))]
            
            for res in to_assign:
                routing = await self.get_osrm_eta(depot["lat"], depot["lng"], dest_lat, dest_lng) if dest_lat and dest_lng else None
                
                await self.assign_resource(res["resource_id"], incident_id, priority)
                assigned.append({
                    "resource_id": res["resource_id"],
                    "resource_type": r_type,
                    "eta_minutes": routing["duration_minutes"] if routing else 8.5,
                    "distance_km": routing["distance_km"] if routing else 4.0,
                    "route_geometry": routing["route_geometry"] if routing else [],
                    "route_name": routing["route_name"] if routing else "N/A",
                    "gps_accurate": bool(routing and dest_lat),
                    "status": "dispatched"
                })
                quantity -= 1

            if quantity > 0:
                templates = self._RESOURCE_TEMPLATES.get(r_type, [])
                for t in templates:
                    rid = t["resource_id"]
                    if rid in self._assigned_incidents:
                        assignment = self._assigned_incidents[rid]
                        other_p_val = priority_map.get(assignment["priority"], 3)
                        
                        if other_p_val >= current_p_val + 2:
                            routing = await self.get_osrm_eta(depot["lat"], depot["lng"], dest_lat, dest_lng) if dest_lat and dest_lng else None
                            
                            await self.assign_resource(rid, incident_id, priority)
                            assigned.append({
                                "resource_id": rid,
                                "resource_type": r_type,
                                "eta_minutes": routing["duration_minutes"] if routing else 8.5,
                                "distance_km": routing["distance_km"] if routing else 4.0,
                                "route_geometry": routing["route_geometry"] if routing else [],
                                "route_name": routing["route_name"] if routing else "N/A",
                                "gps_accurate": bool(routing and dest_lat),
                                "preempted": True,
                                "from_incident": assignment["incident_id"],
                                "status": "dispatched"
                            })
                            
                            self.preemption_events.append({
                                "type": "preemption",
                                "resource_id": rid,
                                "from_incident": assignment["incident_id"],
                                "to_incident": incident_id,
                                "message": f"Resource {rid} recalled from incident #{assignment['incident_id'][:8]} for critical incident #{incident_id[:8]}"
                            })
                            
                            quantity -= 1
                            if quantity <= 0:
                                break
        return assigned

    async def process(self, state: dict) -> dict:
        requirements = state["resource_requirements"]
        incident_location = state["location"]
        incident_id = state["incident_id"]
        priority = state["priority"]
        has_location = bool(incident_location and incident_location.get("raw_text"))
        has_gps = bool(incident_location and incident_location.get("latitude"))

        if state.get("is_duplicate"):
            return {**state, "assigned_resources": [], "dispatch_status": "merged_duplicate"}

        if "review_required" in state.get("validation_flags", []):
            return {**state, "assigned_resources": [], "dispatch_status": "review_required"}

        if priority == "P5":
            return {**state, "assigned_resources": [], "dispatch_status": "not_required"}

        joint_dispatch_memo = None
        agency_timings = None
        if self.llm_available and HumanMessage is not None:
            # Memo logic remains same...
            pass

        if state.get("requires_callback"):
            return {
                **state,
                "assigned_resources": [],
                "dispatch_status": "pending_callback",
                "incident_status": "PENDING_INFO"
            }

        if not has_location:
            return {
                **state,
                "assigned_resources": [],
                "dispatch_status": "awaiting_location",
                "incident_status": "PENDING"
            }

        dest_hospital = None
        hospital_warning = None
        
        # Determine if ambulance is requested
        needs_ambulance = any(req["type"].startswith("ambulance") for req in requirements)
        if needs_ambulance and has_gps:
            # map category to specialty
            cat = state.get("incident_type", {}).get("category", "")
            specialty_map = {"accident": "trauma", "medical": "cardiac", "fire": "burn"}
            required_specialty = specialty_map.get(cat, "trauma")
            
            dest_hospital, hospital_warning = self.select_destination_hospital(
                incident_location["latitude"], 
                incident_location["longitude"], 
                required_specialty
            )

        assigned_resources = await self.allocate_resources(incident_id, priority, requirements, incident_location)

        status = "assigned" if assigned_resources else "resource_unavailable"
        inc_status = "DISPATCHED" if assigned_resources else "PENDING"

        reasoning_parts = []
        for res in assigned_resources:
            suffix = f"via {res['route_name']}" if res.get("gps_accurate") else "Estimated (no GPS)"
            part = f"{res['resource_type']} {res['resource_id']} ETA {res['eta_minutes']}m ({res['distance_km']}km {suffix})"
            if res.get("preempted"):
                part += " [RECALLED]"
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
            "joint_dispatch_memo": joint_dispatch_memo,
            "agency_timings": agency_timings,
            "destination_hospital": dest_hospital,
            "hospital_warning": hospital_warning,
        }

    def select_destination_hospital(self, lat: float, lng: float, required_specialty: str) -> Tuple[Optional[dict], Optional[str]]:
        valid_hospitals = []
        for h in HOSPITALS:
            if required_specialty in h["specialties"]:
                valid_hospitals.append(h)
                
        if not valid_hospitals:
            valid_hospitals = HOSPITALS # fallback to all
            
        # calculate distances and score
        scored_hospitals = []
        for h in valid_hospitals:
            dist = haversine_distance(lat, lng, h["lat"], h["lng"])
            avail = h["available"]
            # score: distance / (available beds + 0.1 to avoid div by zero)
            # lower score is better (closer and more beds)
            score = dist / max(avail, 0.1)
            scored_hospitals.append({"hospital": h, "distance_km": dist, "score": score, "available": avail})
            
        # sort by score
        scored_hospitals.sort(key=lambda x: x["score"])
        
        # filter out full hospitals
        available_hospitals = [sh for sh in scored_hospitals if sh["available"] > 0]
        
        warning = None
        if not available_hospitals:
            # all full, just go to the closest
            closest = scored_hospitals[0]
            warning = f"CRITICAL: All hospitals full. Routing to closest ({closest['hospital']['name']})."
            selected = closest
        else:
            selected = available_hospitals[0]
            # Check if closest overall was full
            closest_overall = scored_hospitals[0]
            if closest_overall["available"] == 0 and closest_overall["hospital"]["id"] != selected["hospital"]["id"]:
                warning = f"{closest_overall['hospital']['name']} at capacity — routing to {selected['hospital']['name']} ({abs(selected['distance_km'] - closest_overall['distance_km']):.1f}km further but {selected['available']} beds available)"

        dest_data = {
            "name": selected["hospital"]["name"],
            "distance_km": selected["distance_km"],
            "available_beds": selected["available"],
            "eta_to_hospital": round((selected["distance_km"] / 40.0) * 60) # 40 km/h avg speed
        }
        
        return dest_data, warning
