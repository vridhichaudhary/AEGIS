from __future__ import annotations

import json
import random
from datetime import datetime
from typing import Dict, List, Literal, Optional

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
    """Dispatches safely, with explicit hold states and priority preemption."""

    # Resource templates — NEVER mutate this directly
    _RESOURCE_TEMPLATES = {
        "ambulance": [
            {"resource_id": "AMB-101", "location": "Central Depot"},
            {"resource_id": "AMB-102", "location": "North Depot"},
            {"resource_id": "AMB-103", "location": "South Depot"},
        ],
        "ambulance_cardiac": [
            {"resource_id": "CARD-201", "location": "Cardiac Center"},
            {"resource_id": "CARD-202", "location": "Metro Cardiac Unit"},
        ],
        "ambulance_trauma": [
            {"resource_id": "TRM-301", "location": "Trauma Center"},
            {"resource_id": "TRM-302", "location": "West Trauma Base"},
        ],
        "fire_truck": [
            {"resource_id": "FIR-401", "location": "Fire Station 1"},
            {"resource_id": "FIR-402", "location": "Fire Station 2"},
        ],
        "fire_truck_rescue": [
            {"resource_id": "FIR-451", "location": "Rescue Station"},
            {"resource_id": "FIR-452", "location": "Rescue Station 2"},
        ],
        "police": [
            {"resource_id": "POL-501", "location": "Police HQ"},
            {"resource_id": "POL-502", "location": "North Police HQ"},
        ],
        "rescue_team": [
            {"resource_id": "RSC-601", "location": "Disaster Response Base"},
            {"resource_id": "RSC-602", "location": "River Rescue Base"},
        ],
    }
    
    # Per-process assignment registry; tracks which resource IDs are dispatched
    # Format: resource_id -> {"incident_id": str, "priority": str, "status": str}
    _assigned_incidents: Dict[str, dict] = {} 

    # Track preemption events for broadcast
    preemption_events: List[dict] = []

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
        """Returns fresh copies of available units."""
        templates = self._RESOURCE_TEMPLATES.get(resource_type, [])
        return [
            {**t, "status": "available"}
            for t in templates
            if t["resource_id"] not in self._assigned_incidents or self._assigned_incidents[t["resource_id"]].get("status") == "available"
        ]

    def calculate_mock_eta(self, resource: Dict, destination: Dict) -> float:
        """ETA heuristic: base 4-8 min urban, +penalty if no location."""
        if destination and destination.get("raw_text"):
            base = random.uniform(4.0, 8.0)
        else:
            base = random.uniform(8.0, 15.0)
        return round(base, 1)

    async def assign_resource(self, resource_id: str, incident_id: str, priority: str, status: str = "dispatched"):
        """Mark resource as dispatched in the registry."""
        self._assigned_incidents[resource_id] = {
            "incident_id": incident_id,
            "priority": priority,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }

    async def release_resources(self, incident_id: str) -> List[str]:
        """Release all resources assigned to an incident."""
        released = []
        for rid, assignment in list(self._assigned_incidents.items()):
            if assignment.get("incident_id") == incident_id:
                # Mark as returning to base (available but with state)
                assignment["status"] = "available" # In simple version, just make it available
                # But actually the user wants a "returning" state handled in background
                # For now, we'll just remove it or set status
                del self._assigned_incidents[rid]
                released.append(rid)
        return released

    async def allocate_resources(self, incident_id: str, priority: str, requirements: List[dict], location: dict) -> List[dict]:
        """Main allocation logic with priority preemption."""
        assigned = []
        priority_map = {"P1": 1, "P2": 2, "P3": 3, "P4": 4, "P5": 5}
        current_p_val = priority_map.get(priority, 3)

        for req in requirements:
            r_type = req["type"]
            quantity = req.get("quantity", 1)
            
            # 1. Try to get available resources
            available = await self.query_available_resources(r_type)
            
            to_assign = available[: min(quantity, len(available))]
            for res in to_assign:
                eta = self.calculate_mock_eta(res, location)
                await self.assign_resource(res["resource_id"], incident_id, priority)
                assigned.append({
                    "resource_id": res["resource_id"],
                    "resource_type": r_type,
                    "eta_minutes": round(eta, 1),
                    "distance_km": round(eta * 0.5, 2),
                    "status": "dispatched"
                })
                quantity -= 1

            # 2. If still need more, try preemption
            if quantity > 0:
                # Find resources of this type assigned to lower priority incidents (diff >= 2)
                templates = self._RESOURCE_TEMPLATES.get(r_type, [])
                for t in templates:
                    rid = t["resource_id"]
                    if rid in self._assigned_incidents:
                        assignment = self._assigned_incidents[rid]
                        other_p_val = priority_map.get(assignment["priority"], 3)
                        
                        if other_p_val >= current_p_val + 2:
                            # Preempt!
                            old_incident_id = assignment["incident_id"]
                            old_priority = assignment["priority"]
                            
                            eta = self.calculate_mock_eta(t, location)
                            await self.assign_resource(rid, incident_id, priority)
                            
                            preempt_info = {
                                "resource_id": rid,
                                "resource_type": r_type,
                                "eta_minutes": round(eta, 1),
                                "distance_km": round(eta * 0.5, 2),
                                "preempted": True,
                                "from_incident": old_incident_id,
                                "status": "dispatched"
                            }
                            assigned.append(preempt_info)
                            
                            self.preemption_events.append({
                                "type": "preemption",
                                "resource_id": rid,
                                "from_incident": old_incident_id,
                                "from_priority": old_priority,
                                "to_incident": incident_id,
                                "to_priority": priority,
                                "message": f"Resource {rid} recalled from incident #{old_incident_id[:8]} ({old_priority}) for critical incident #{incident_id[:8]} ({priority})"
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

        if state.get("is_duplicate"):
            return {**state, "assigned_resources": [], "dispatch_status": "merged_duplicate"}

        if "review_required" in state.get("validation_flags", []):
            return {**state, "assigned_resources": [], "dispatch_status": "review_required"}

        if priority == "P5":
            return {**state, "assigned_resources": [], "dispatch_status": "not_required"}

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
            return {
                **state,
                "assigned_resources": [],
                "dispatch_status": "awaiting_location",
                "incident_status": "PENDING"
            }

        # Use new allocation logic
        assigned_resources = await self.allocate_resources(incident_id, priority, requirements, incident_location)

        status = "assigned" if assigned_resources else "resource_unavailable"
        inc_status = "DISPATCHED" if assigned_resources else "PENDING"

        # Construct reasoning including preemption
        reasoning_parts = []
        for res in assigned_resources:
            part = f"{res['resource_type']} {res['resource_id']} ETA {res['eta_minutes']}m"
            if res.get("preempted"):
                part += " (PREEMPTED)"
            reasoning_parts.append(part)
        
        reasoning = ", ".join(reasoning_parts) if assigned_resources else "No suitable resources available."

        state["agent_trail"].append({
            "agent": "dispatch",
            "timestamp": datetime.now(),
            "decision": "Dispatched resources" if assigned_resources else "Resource shortage",
            "reasoning": reasoning,
        })

        return {
            **state,
            "assigned_resources": assigned_resources,
            "dispatch_status": status,
            "incident_status": inc_status,
            "dispatch_timestamp": datetime.now() if assigned_resources else None,
            "joint_dispatch_memo": joint_dispatch_memo, # Should be filled from LLM if active
            "agency_timings": agency_timings,
        }
