import redis
import json
from typing import List, Optional, Dict
from datetime import datetime
from config.settings import settings

class DispatchAgent:
    """Assigns optimal resources based on availability and distance"""
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    
    async def query_available_resources(self, resource_type: str) -> List[Dict]:
        """Query Redis for available resources of given type"""
        try:
            search_key = f"resource:{resource_type}:*"
            keys = self.redis_client.keys(search_key)
            
            available = []
            for key in keys:
                data = self.redis_client.get(key)
                if not data:
                    continue
                
                resource = json.loads(data)
                if resource.get("status") == "available":
                    available.append(resource)
            
            return available
        except Exception as e:
            print(f"Redis query error: {e}")
            return []
    
    def calculate_mock_eta(self, resource: Dict, destination: Dict) -> float:
        """Calculate simple mock ETA in minutes"""
        # For demo: random ETA between 3-15 minutes
        import random
        return random.uniform(3.0, 15.0)
    
    async def assign_resource(self, resource_id: str, incident_id: str):
        """Update resource status in Redis"""
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
        except Exception as e:
            print(f"Redis assign error: {e}")
    
    async def process(self, state: dict) -> dict:
        """Main dispatch logic"""
        requirements = state["resource_requirements"]
        incident_location = state["location"]
        incident_id = state["incident_id"]
        
        assigned_resources = []
        
        for req in requirements:
            resource_type = req["type"]
            quantity = req.get("quantity", 1)
            
            # Query available resources
            available = await self.query_available_resources(resource_type)
            
            if not available:
                state["errors"].append(f"No available {resource_type}")
                continue
            
            # Assign resources
            for i in range(min(quantity, len(available))):
                resource = available[i]
                eta = self.calculate_mock_eta(resource, incident_location)
                
                await self.assign_resource(resource["resource_id"], incident_id)
                
                assigned_resources.append({
                    "resource_id": resource["resource_id"],
                    "resource_type": resource_type,
                    "eta_minutes": round(eta, 1),
                    "distance_km": round(eta * 0.5, 2),  # Mock distance
                    "route": []
                })
        
        # Log decision
        if assigned_resources:
            decision = f"Dispatched {len(assigned_resources)} resource(s)"
            reasoning = ", ".join([
                f"{r['resource_type']} {r['resource_id']} (ETA: {r['eta_minutes']} min)"
                for r in assigned_resources
            ])
        else:
            decision = "No resources assigned"
            reasoning = "No available units matching requirements"
        
        state["agent_trail"].append({
            "agent": "dispatch",
            "timestamp": datetime.now(),
            "decision": decision,
            "reasoning": reasoning
        })
        
        return {
            **state,
            "assigned_resources": assigned_resources,
            "dispatch_status": "assigned" if assigned_resources else "pending",
            "dispatch_timestamp": datetime.now() if assigned_resources else None
        }