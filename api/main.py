from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import asyncio

from agents.supervisor import SupervisorAgent
from config.settings import settings
from simulation.scenarios import SimulationScenarios

app = FastAPI(title="AEGIS API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize supervisor
supervisor = SupervisorAgent()

# Request/Response Models
class EmergencyCallRequest(BaseModel):
    transcript: str
    caller_id: Optional[str] = None

class EmergencyCallResponse(BaseModel):
    incident_id: str
    status: str
    priority: str
    assigned_resources: List[dict]
    eta_minutes: Optional[float]
    dispatch_status: str
    agent_trail: List[dict]

# Endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/v1/emergency/report", response_model=EmergencyCallResponse)
async def report_emergency(request: EmergencyCallRequest):
    """Main endpoint: process emergency call"""
    try:
        result = await supervisor.process_call(
            raw_transcript=request.transcript,
            caller_id=request.caller_id
        )
        
        # Calculate minimum ETA
        eta = None
        if result["assigned_resources"]:
            eta = min([r["eta_minutes"] for r in result["assigned_resources"]])
        
        return EmergencyCallResponse(
            incident_id=result["incident_id"],
            status="processed",
            priority=result["priority"],
            assigned_resources=result["assigned_resources"],
            eta_minutes=eta,
            dispatch_status=result["dispatch_status"],
            agent_trail=result["agent_trail"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/incidents/active")
async def get_active_incidents():
    """Get all active incidents"""
    return {"incidents": []}

@app.post("/api/v1/simulation/run")
async def run_simulation(scenario: str = "normal", count: int = 5):
    """Trigger simulation for demo"""
    scenarios = SimulationScenarios()
    
    if scenario == "normal":
        incidents = scenarios.normal_load()[:count]
    elif scenario == "flood":
        incidents = scenarios.disaster_flood()[:count]
    elif scenario == "prank":
        incidents = scenarios.prank_storm()[:count]
    else:
        raise HTTPException(400, "Invalid scenario")
    
    results = []
    for incident in incidents:
        result = await supervisor.process_call(incident["transcript"])
        results.append({
            "incident_id": result["incident_id"],
            "priority": result["priority"],
            "dispatch_status": result["dispatch_status"]
        })
    
    return {"processed": len(results), "results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)