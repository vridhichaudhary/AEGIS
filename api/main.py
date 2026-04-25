import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.supervisor import SupervisorAgent
from agents.base_agent import BaseAgent
from agents.cascade_agent import CascadePredictionAgent
from agents.command_agent import CommandAgent
from config.settings import settings
from simulation.scenarios import SimulationScenarios

app = FastAPI(title="AEGIS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        stale_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)


manager = ConnectionManager()
supervisor = SupervisorAgent()
cascade_agent = CascadePredictionAgent()
command_agent = CommandAgent()
active_incidents: Dict[str, dict] = {}


async def proactive_threat_loop():
    while True:
        await asyncio.sleep(60)
        recent = list(active_incidents.values())
        if recent:
            try:
                intel = await cascade_agent.analyze(recent)
                if intel:
                    await manager.broadcast({"type": "threat_intelligence", "payload": intel})
            except Exception as e:
                print(f"Error in threat loop: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(proactive_threat_loop())


class EmergencyCallRequest(BaseModel):
    transcript: str
    caller_id: Optional[str] = None


class CommandAgentRequest(BaseModel):
    command: str
    language: str = "en-US"


class EmergencyCallResponse(BaseModel):
    incident_id: str
    status: str
    priority: str
    assigned_resources: List[dict]
    eta_minutes: Optional[float]
    dispatch_status: str
    agent_trail: List[dict]
    golden_hour_deadline: Optional[str] = None
    golden_hour_at_risk: Optional[bool] = None
    authenticity_score: Optional[int] = None
    joint_dispatch_memo: Optional[dict] = None
    agency_timings: Optional[dict] = None


def serialize_incident(result: dict) -> dict:
    # Convert confidence_score float (0.0-1.0) back to int (0-100) for frontend gauge
    score = int(result.get("confidence_score", 1.0) * 100)
    
    return {
        "incident_id": result["incident_id"],
        "priority": result["priority"],
        "status": result["dispatch_status"],
        "dispatch_status": result["dispatch_status"],
        "timestamp": datetime.now().isoformat(),
        "location": result.get("location"),
        "incident_type": result.get("incident_type"),
        "assigned_resources": result.get("assigned_resources", []),
        "errors": result.get("errors", []),
        "golden_hour_deadline": result.get("golden_hour_deadline").isoformat() if result.get("golden_hour_deadline") else None,
        "golden_hour_at_risk": result.get("golden_hour_at_risk", False),
        "authenticity_score": score,
        "joint_dispatch_memo": result.get("joint_dispatch_memo"),
        "agency_timings": result.get("agency_timings"),
    }


async def publish_result(result: dict):
    """Broadcast incident and resource updates to WebSocket clients"""
    incident_payload = serialize_incident(result)
    active_incidents[result["incident_id"]] = incident_payload
    
    # Broadcast incident update
    await manager.broadcast({"type": "incident_update", "payload": incident_payload})
    
    # Broadcast resource updates with full details
    resources_to_broadcast = []
    for resource in result.get("assigned_resources", []):
        # Fetch full resource data from Redis or fallback
        resource_data = {
            "id": resource["resource_id"],
            "name": resource["resource_id"],
            "type": resource["resource_type"],
            "status": "dispatched",
            "location": result.get("location"),  # Incident location
        }
        resources_to_broadcast.append(resource_data)
    
    if resources_to_broadcast:
        await manager.broadcast({
            "type": "resource_update",
            "payload": resources_to_broadcast
        })
    
    # Broadcast agent events
    for event in result.get("agent_trail", []):
        safe_event = {
            "agent": event.get("agent"),
            "decision": event.get("decision"),
            "reasoning": event.get("reasoning"),
            "timestamp": event["timestamp"].isoformat() if hasattr(event.get("timestamp"), "isoformat") else str(event.get("timestamp"))
        }
        await manager.broadcast({"type": "agent_event", "payload": safe_event})


@app.get("/health")
async def health_check():
    llm_probe = BaseAgent()
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "llm": llm_probe.llm_diagnostics,
        "redis_host": settings.REDIS_HOST,
        "environment": settings.ENVIRONMENT,
    }


@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/api/v1/command")
async def process_voice_command(request: CommandAgentRequest):
    recent = list(active_incidents.values())
    all_assigned = []
    for inc in recent:
        all_assigned.extend(inc.get("assigned_resources", []))
    try:
        response = await command_agent.process_command(request.command, request.language, recent, all_assigned)
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


from agents.report_agent import ReportAgent

report_agent = ReportAgent()

@app.get("/api/v1/report/generate")
async def generate_aar():
    recent = list(active_incidents.values())
    if not recent:
        raise HTTPException(status_code=400, detail="No incidents to report on.")
    
    try:
        report = await report_agent.generate_report(recent)
        if not report:
            raise HTTPException(status_code=500, detail="Failed to generate report.")
        return report
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/v1/emergency/report", response_model=EmergencyCallResponse)
async def report_emergency(request: EmergencyCallRequest):
    try:
        result = await supervisor.process_call(raw_transcript=request.transcript, caller_id=request.caller_id)
        eta = min((resource["eta_minutes"] for resource in result["assigned_resources"]), default=None)
        await publish_result(result)

        return EmergencyCallResponse(
            incident_id=result["incident_id"],
            status="processed",
            priority=result["priority"],
            assigned_resources=result["assigned_resources"],
            eta_minutes=eta,
            dispatch_status=result["dispatch_status"],
            agent_trail=result["agent_trail"],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/v1/incidents/active")
async def get_active_incidents():
    return {"incidents": list(active_incidents.values())}


@app.post("/api/v1/simulation/run")
async def run_simulation(scenario: str = "normal", count: int = 5):
    scenarios = SimulationScenarios()

    if scenario == "normal":
        incidents = scenarios.normal_load()[:count]
    elif scenario == "flood":
        incidents = scenarios.disaster_flood()[:count]
    elif scenario == "prank":
        incidents = scenarios.prank_storm()[:count]
    else:
        raise HTTPException(status_code=400, detail="Invalid scenario")

    for incident in incidents:
        asyncio.create_task(process_simulated_incident(incident["transcript"]))

    return {"queued": len(incidents)}


async def process_simulated_incident(transcript: str):
    try:
        result = await supervisor.process_call(transcript)
        await publish_result(result)
    except Exception as exc:
        print(f"Simulation error: {exc}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
