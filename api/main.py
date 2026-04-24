import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.supervisor import SupervisorAgent
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
active_incidents: Dict[str, dict] = {}


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


def serialize_incident(result: dict) -> dict:
    return {
        "incident_id": result["incident_id"],
        "priority": result["priority"],
        "status": result["dispatch_status"],
        "timestamp": datetime.now().isoformat(),
        "location": result.get("location"),
        "incident_type": result.get("incident_type"),
        "assigned_resources": result.get("assigned_resources", []),
        "errors": result.get("errors", []),
    }


async def publish_result(result: dict):
    incident_payload = serialize_incident(result)
    active_incidents[result["incident_id"]] = incident_payload

    await manager.broadcast({"type": "incident_update", "payload": incident_payload})

    await manager.broadcast(
        {
            "type": "resource_update",
            "payload": [
                {
                    "id": resource["resource_id"],
                    "type": resource["resource_type"],
                    "status": "dispatched",
                    "location": incident_payload["location"]["raw_text"] if incident_payload["location"] else "",
                }
                for resource in result.get("assigned_resources", [])
            ],
        }
    )

    for event in result.get("agent_trail", []):
        safe_event = {
            **event,
            "timestamp": event["timestamp"].isoformat() if hasattr(event.get("timestamp"), "isoformat") else event.get("timestamp"),
        }
        await manager.broadcast({"type": "agent_event", "payload": safe_event})


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


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
