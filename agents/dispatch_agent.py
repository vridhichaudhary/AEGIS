from __future__ import annotations

import json
import random
from datetime import datetime
from typing import Dict, List

from config.settings import settings

try:
    import redis
except ImportError:  # pragma: no cover - optional dependency
    redis = None


class DispatchAgent:
    """Assigns resources using Redis when available and an in-memory pool otherwise."""

    _fallback_resources = {
        "ambulance": [
            {"resource_id": "AMB-101", "status": "available", "location": "Central Depot"},
            {"resource_id": "AMB-102", "status": "available", "location": "North Depot"},
        ],
        "ambulance_cardiac": [
            {"resource_id": "CARD-201", "status": "available", "location": "Cardiac Center"},
        ],
        "ambulance_trauma": [
            {"resource_id": "TRM-301", "status": "available", "location": "Trauma Center"},
        ],
        "fire_truck": [
            {"resource_id": "FIR-401", "status": "available", "location": "Fire Station 1"},
        ],
        "fire_truck_rescue": [
            {"resource_id": "FIR-451", "status": "available", "location": "Rescue Station"},
        ],
        "police": [
            {"resource_id": "POL-501", "status": "available", "location": "Police HQ"},
        ],
        "rescue_team": [
            {"resource_id": "RSC-601", "status": "available", "location": "Disaster Response Base"},
        ],
    }

    def __init__(self):
        self.redis_client = None
        if redis is not None:
            try:
                client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    decode_responses=True,
                    socket_connect_timeout=0.2,
                    socket_timeout=0.2,
                )
                client.ping()
                self.redis_client = client
            except Exception:
                self.redis_client = None

    async def query_available_resources(self, resource_type: str) -> List[Dict]:
        if self.redis_client is not None:
            try:
                search_key = f"resource:{resource_type}:*"
                available = []
                for key in self.redis_client.keys(search_key):
                    data = self.redis_client.get(key)
                    if not data:
                        continue
                    resource = json.loads(data)
                    if resource.get("status") == "available":
                        available.append(resource)
                if available:
                    return available
            except Exception:
                pass

        return [resource.copy() for resource in self._fallback_resources.get(resource_type, []) if resource["status"] == "available"]

    def calculate_mock_eta(self, resource: Dict, destination: Dict) -> float:
        return random.uniform(3.0, 15.0)

    async def assign_resource(self, resource_id: str, incident_id: str):
        if self.redis_client is not None:
            try:
                key = f"resource:*:{resource_id}"
                keys = self.redis_client.keys(key)
                if keys:
                    data = self.redis_client.get(keys[0])
                    resource = json.loads(data)
                    resource["status"] = "dispatched"
                    resource["assigned_incident"] = incident_id
                    resource["dispatch_time"] = datetime.now().isoformat()
                    self.redis_client.set(keys[0], json.dumps(resource))
                    return
            except Exception:
                pass

        for resources in self._fallback_resources.values():
            for resource in resources:
                if resource["resource_id"] == resource_id:
                    resource["status"] = "dispatched"
                    resource["assigned_incident"] = incident_id
                    resource["dispatch_time"] = datetime.now().isoformat()
                    return

    async def process(self, state: dict) -> dict:
        requirements = state["resource_requirements"]
        incident_location = state["location"]
        incident_id = state["incident_id"]
        assigned_resources = []

        for req in requirements:
            resource_type = req["type"]
            quantity = req.get("quantity", 1)
            available = await self.query_available_resources(resource_type)

            if not available:
                state["errors"].append(f"No available {resource_type}")
                continue

            for resource in available[: min(quantity, len(available))]:
                eta = self.calculate_mock_eta(resource, incident_location)
                await self.assign_resource(resource["resource_id"], incident_id)
                assigned_resources.append(
                    {
                        "resource_id": resource["resource_id"],
                        "resource_type": resource_type,
                        "eta_minutes": round(eta, 1),
                        "distance_km": round(eta * 0.5, 2),
                        "route": [],
                    }
                )

        if assigned_resources:
            decision = f"Dispatched {len(assigned_resources)} resource(s)"
            reasoning = ", ".join(
                f"{resource['resource_type']} {resource['resource_id']} (ETA: {resource['eta_minutes']} min)"
                for resource in assigned_resources
            )
        else:
            decision = "No resources assigned"
            reasoning = "No available units matching requirements"

        state["agent_trail"].append(
            {
                "agent": "dispatch",
                "timestamp": datetime.now(),
                "decision": decision,
                "reasoning": reasoning,
            }
        )

        return {
            **state,
            "assigned_resources": assigned_resources,
            "dispatch_status": "assigned" if assigned_resources else "pending",
            "dispatch_timestamp": datetime.now() if assigned_resources else None,
        }
