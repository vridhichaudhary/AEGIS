from __future__ import annotations

import json
import random
from datetime import datetime
from typing import Dict, List, Literal

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from config.settings import settings

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
    """Dispatches safely, with explicit hold states when location is missing."""

    _fallback_resources = {
        "ambulance": [
            {"resource_id": "AMB-101", "status": "available", "location": "Central Depot"},
            {"resource_id": "AMB-102", "status": "available", "location": "North Depot"},
            {"resource_id": "AMB-103", "status": "available", "location": "South Depot"},
        ],
        "ambulance_cardiac": [
            {"resource_id": "CARD-201", "status": "available", "location": "Cardiac Center"},
            {"resource_id": "CARD-202", "status": "available", "location": "Metro Cardiac Unit"},
        ],
        "ambulance_trauma": [
            {"resource_id": "TRM-301", "status": "available", "location": "Trauma Center"},
            {"resource_id": "TRM-302", "status": "available", "location": "West Trauma Base"},
        ],
        "fire_truck": [
            {"resource_id": "FIR-401", "status": "available", "location": "Fire Station 1"},
            {"resource_id": "FIR-402", "status": "available", "location": "Fire Station 2"},
        ],
        "fire_truck_rescue": [
            {"resource_id": "FIR-451", "status": "available", "location": "Rescue Station"},
            {"resource_id": "FIR-452", "status": "available", "location": "Rescue Station 2"},
        ],
        "police": [
            {"resource_id": "POL-501", "status": "available", "location": "Police HQ"},
            {"resource_id": "POL-502", "status": "available", "location": "North Police HQ"},
        ],
        "rescue_team": [
            {"resource_id": "RSC-601", "status": "available", "location": "Disaster Response Base"},
            {"resource_id": "RSC-602", "status": "available", "location": "River Rescue Base"},
        ],
    }

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=JointDispatchMemo)
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
                available = []
                for key in self.redis_client.keys(f"resource:{resource_type}:*"):
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
                keys = self.redis_client.keys(f"resource:*:{resource_id}")
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
        has_location = bool(incident_location and incident_location.get("raw_text"))

        if state.get("is_duplicate"):
            state["agent_trail"].append(
                {
                    "agent": "dispatch",
                    "timestamp": datetime.now(),
                    "decision": "Merged duplicate report",
                    "reasoning": f"Matched existing incident {state.get('duplicate_of')}; suppressing redundant dispatch.",
                }
            )
            return {
                **state,
                "assigned_resources": [],
                "dispatch_status": "merged_duplicate",
                "dispatch_timestamp": None,
                "joint_dispatch_memo": None,
                "agency_timings": None,
            }

        if "review_required" in state.get("validation_flags", []):
            state["agent_trail"].append(
                {
                    "agent": "dispatch",
                    "timestamp": datetime.now(),
                    "decision": "Dispatch held pending human review",
                    "reasoning": "Validation score indicates potential hoax/prank. Retaining incident in Review Queue.",
                }
            )
            return {
                **state,
                "assigned_resources": [],
                "dispatch_status": "review_required",
                "dispatch_timestamp": None,
                "joint_dispatch_memo": None,
                "agency_timings": None,
            }

        if state["priority"] == "P5":
            state["agent_trail"].append(
                {
                    "agent": "dispatch",
                    "timestamp": datetime.now(),
                    "decision": "No dispatch",
                    "reasoning": "Incident classified as non-emergency after validation and triage.",
                }
            )
            return {
                **state, 
                "assigned_resources": [], 
                "dispatch_status": "not_required", 
                "dispatch_timestamp": None,
                "joint_dispatch_memo": None,
                "agency_timings": None,
            }

        joint_dispatch_memo = None
        agency_timings = None

        if self.llm_available and HumanMessage is not None:
            prompt = f"""You are a multi-agency dispatch coordinator in India.
Analyze the incident and determine which agencies need to be involved:
- POLICE (100): crowd control, crime scenes, traffic management, violence
- FIRE (101): structural fires, gas leaks, entrapment, major rescue
- MEDICAL (108): injuries, cardiac events, poisoning

Generate a joint dispatch memo containing specific instructions for the relevant agencies. If an agency is not needed, set its instructions to 'None'.

Incident Type: {state.get('incident_type', {}).get('category', 'unknown')}
Transcript: {state.get('normalized_text', '')}
Requirements: {requirements}

{self.parser.get_format_instructions()}"""
            try:
                response = await self.invoke_llm([HumanMessage(content=prompt)])
                joint_dispatch_memo = self.parser.parse(response.content)
                
                # Compute agency timings if memo exists
                involved_agencies = []
                if joint_dispatch_memo.get("police_instructions", "None").lower() not in ["none", "n/a", ""]:
                    involved_agencies.append("POLICE")
                if joint_dispatch_memo.get("fire_instructions", "None").lower() not in ["none", "n/a", ""]:
                    involved_agencies.append("FIRE")
                if joint_dispatch_memo.get("medical_instructions", "None").lower() not in ["none", "n/a", ""]:
                    involved_agencies.append("MEDICAL")
                
                if len(involved_agencies) > 0:
                    timings = {}
                    for idx, agency in enumerate(involved_agencies):
                        delay = random.uniform(10 + idx*15, 25 + idx*25) 
                        timings[agency] = delay
                    
                    sorted_agencies = sorted(timings.keys(), key=lambda a: timings[a])
                    timeline = [{"agency": a, "delay_seconds": round(timings[a], 1)} for a in sorted_agencies]
                    gap = timeline[-1]["delay_seconds"] - timeline[0]["delay_seconds"] if len(timeline) > 1 else 0.0
                    
                    agency_timings = {
                        "timeline": timeline,
                        "coordination_gap_seconds": round(gap, 1),
                        "is_multi_agency": len(timeline) > 1
                    }

            except Exception as exc:
                state["errors"].append(f"Dispatch LLM fallback: {exc}")

        if not has_location:
            decision = "Dispatch held pending callback"
            reasoning = "Life-critical intent detected but no dispatchable location was extracted."
            if state["priority"] in {"P1", "P2"}:
                reasoning += " Mark incident for priority callback and supervisor review immediately."
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
                "assigned_resources": [],
                "dispatch_status": "awaiting_location",
                "dispatch_timestamp": None,
                "joint_dispatch_memo": joint_dispatch_memo,
                "agency_timings": agency_timings,
            }

        for req in requirements:
            available = await self.query_available_resources(req["type"])
            quantity = req.get("quantity", 1)
            if not available:
                state["errors"].append(f"No available {req['type']}")
                continue

            for resource in available[: min(quantity, len(available))]:
                eta = self.calculate_mock_eta(resource, incident_location)
                await self.assign_resource(resource["resource_id"], incident_id)
                assigned_resources.append(
                    {
                        "resource_id": resource["resource_id"],
                        "resource_type": req["type"],
                        "eta_minutes": round(eta, 1),
                        "distance_km": round(eta * 0.5, 2),
                        "route": [],
                    }
                )

        decision = "Dispatched resources" if assigned_resources else "No resources assigned"
        reasoning = (
            ", ".join(
                f"{resource['resource_type']} {resource['resource_id']} ETA {resource['eta_minutes']}m"
                for resource in assigned_resources
            )
            if assigned_resources
            else "No suitable resources were available for the requested capability."
        )
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
            "dispatch_status": "assigned" if assigned_resources else "resource_unavailable",
            "dispatch_timestamp": datetime.now() if assigned_resources else None,
            "joint_dispatch_memo": joint_dispatch_memo,
            "agency_timings": agency_timings,
        }
