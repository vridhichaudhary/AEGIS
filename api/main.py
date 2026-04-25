import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.supervisor import SupervisorAgent
from agents.base_agent import BaseAgent
from agents.cascade_agent import CascadePredictionAgent
from agents.command_agent import CommandAgent
from agents.report_agent import ReportAgent
from agents.audio_agent import AudioIngestionAgent
from config.settings import settings
from simulation.scenarios import SimulationScenarios
import db.database as db

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
report_agent = ReportAgent()
audio_agent = AudioIngestionAgent()
active_incidents: Dict[str, dict] = {}
CALLBACK_QUEUE: List[dict] = []
CALLBACK_METRICS = {"total_pending": 0, "total_resolved": 0}

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

async def resource_refresh_loop():
    """Background task to simulate resources returning to base."""
    while True:
        await asyncio.sleep(90)
        # Randomly select a few resources that are in the registry but maybe marked as returning
        # In this simple mock, we'll just broadcast that some units are now 'available' again
        # to clear any UI 'returning' states
        await manager.broadcast({
            "type": "resource_update",
            "payload": [
                {"id": "AMB-101", "status": "available", "name": "AMB-101", "type": "ambulance"},
                {"id": "FIR-401", "status": "available", "name": "FIR-401", "type": "fire_truck"}
            ]
        })

@app.on_event("startup")
async def startup_event():
    # Initialize SQLite database
    db.init_db()
    
    # Hydrate in-memory state
    history = db.get_all_incidents(limit=100)
    for inc in history:
        if inc["status"] != "RESOLVED" and inc["status"] != "merged_duplicate":
            active_incidents[inc["incident_id"]] = inc

    asyncio.create_task(proactive_threat_loop())
    asyncio.create_task(resource_refresh_loop())


class EmergencyCallRequest(BaseModel):
    transcript: str
    caller_id: Optional[str] = None

    model_config = {"str_strip_whitespace": True}

    def validate_transcript(self):
        if not self.transcript or len(self.transcript.strip()) < 3:
            raise ValueError("Transcript must be at least 3 characters.")


class CommandAgentRequest(BaseModel):
    command: str
    language: str = "en-US"

class CallbackResponseRequest(BaseModel):
    additional_info: str

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
        "is_duplicate": result.get("is_duplicate", False),
        "duplicate_of": result.get("duplicate_of"),
        "duplicate_confidence": result.get("duplicate_confidence", 0.0),
        "audio_source": result.get("audio_source"),
        "requires_callback": result.get("requires_callback", False),
        "missing_fields": result.get("missing_fields", []),
        "suggested_callback_script": result.get("suggested_callback_script"),
        "triage_method": result.get("triage_method", "heuristic"),
        "transcript": result.get("raw_transcript", ""),
    }


async def publish_result(result: dict):
    """Broadcast incident and resource updates to WebSocket clients"""
    incident_payload = serialize_incident(result)
    active_incidents[result["incident_id"]] = incident_payload
    
    # Handle callback queue logic
    if incident_payload.get("requires_callback"):
        callback_entry = {
            "caller_id": result.get("caller_id") or "Unknown",
            "incident_id": result["incident_id"],
            "transcript": result.get("raw_transcript", ""),
            "missing_fields": incident_payload.get("missing_fields", []),
            "suggested_question": incident_payload.get("suggested_callback_script", ""),
            "created_at": datetime.now().isoformat(),
            "attempts": 1
        }
        # Check if already in queue to avoid duplicates
        if not any(c["incident_id"] == result["incident_id"] for c in CALLBACK_QUEUE):
            CALLBACK_QUEUE.append(callback_entry)
            CALLBACK_METRICS["total_pending"] += 1
            await manager.broadcast({"type": "callback_update", "payload": callback_entry})

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
            "duplicate_confidence": event.get("duplicate_confidence"),
            "duplicate_of": event.get("duplicate_of"),
            "timestamp": event["timestamp"].isoformat() if hasattr(event.get("timestamp"), "isoformat") else str(event.get("timestamp"))
        }
        await manager.broadcast({"type": "agent_event", "payload": safe_event})

    # Check for and broadcast preemption events from the DispatchAgent
    if hasattr(supervisor.dispatch, "preemption_events"):
        while supervisor.dispatch.preemption_events:
            p_event = supervisor.dispatch.preemption_events.pop(0)
            await manager.broadcast({
                "type": "system_alert",
                "payload": {
                    "level": "warning",
                    "title": "Priority Preemption",
                    "message": p_event["message"],
                    "incident_id": p_event["to_incident"]
                }
            })

    # Save to SQLite asynchronously
    asyncio.create_task(asyncio.to_thread(db.save_incident, incident_payload))


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


@app.get("/api/v1/report/generate")
async def generate_aar():
    recent = list(active_incidents.values())
    if not recent:
        raise HTTPException(status_code=400, detail="No incidents to report on. Run a simulation first.")
    
    # Cap at 30 most-recent incidents to avoid LLM token limits
    capped = recent[-30:]
    try:
        report = await report_agent.generate_report(capped)
        if not report:
            raise HTTPException(
                status_code=429,
                detail="LLM rate limit reached or provider unavailable. Please try again in a few minutes."
            )
        return report
    except HTTPException:
        raise
    except Exception as exc:
        err_str = str(exc)
        if "429" in err_str or "rate_limit" in err_str.lower():
            raise HTTPException(status_code=429, detail="LLM daily token limit reached. Try again in a few minutes.")
        raise HTTPException(status_code=500, detail=err_str)

@app.post("/api/v1/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    if incident_id not in active_incidents:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident = active_incidents[incident_id]
    incident["status"] = "RESOLVED"
    incident["incident_status"] = "RESOLVED"
    
    # Release resources in DispatchAgent
    released_ids = await supervisor.dispatch.release_resources(incident_id)
    
    # Broadcast resolution
    await manager.broadcast({
        "type": "incident_resolved",
        "payload": {
            "incident_id": incident_id,
            "released_resources": released_ids,
            "freed_count": len(released_ids)
        }
    })
    
    # Also broadcast individual resource updates as 'returning'
    if released_ids:
        updates = []
        for rid in released_ids:
            updates.append({
                "id": rid,
                "status": "returning",
                "eta_return": random.randint(1, 3) # mock minutes to base
            })
        await manager.broadcast({"type": "resource_update", "payload": updates})

    # Update SQLite asynchronously
    asyncio.create_task(asyncio.to_thread(db.update_incident_status, incident_id, "RESOLVED"))

    return {"status": "success", "resolved_id": incident_id, "freed": len(released_ids)}

@app.get("/api/v1/resources")
async def get_resources():
    all_res = []
    for r_type, templates in supervisor.dispatch._RESOURCE_TEMPLATES.items():
        for t in templates:
            rid = t["resource_id"]
            assignment = supervisor.dispatch._assigned_incidents.get(rid, {"status": "available"})
            all_res.append({
                "id": rid,
                "name": rid,
                "type": r_type,
                "status": assignment.get("status", "available"),
                "location": t["location"]
            })
    return {"resources": all_res}

@app.get("/api/v1/incidents/history")
async def get_incident_history(limit: int = 50):
    # Run DB fetch in background thread
    history = await asyncio.to_thread(db.get_all_incidents, limit)
    return {"incidents": history}

@app.get("/api/v1/metrics/snapshot")
async def get_metrics_snapshot():
    # Run DB fetch in background thread
    metrics = await asyncio.to_thread(db.get_metrics)
    metrics["callback_metrics"] = CALLBACK_METRICS
    metrics["callback_queue_length"] = len(CALLBACK_QUEUE)
    return metrics

@app.get("/api/v1/callbacks")
async def get_callbacks():
    return {"callbacks": CALLBACK_QUEUE}

@app.post("/api/v1/callback/{incident_id}/response")
async def process_callback_response(incident_id: str, request: CallbackResponseRequest):
    # Find the incident in the queue
    callback_entry = next((c for c in CALLBACK_QUEUE if c["incident_id"] == incident_id), None)
    if not callback_entry:
        raise HTTPException(status_code=404, detail="Incident not found in callback queue")
    
    # Combine transcripts
    combined_transcript = f"{callback_entry['transcript']} [Callback Additions]: {request.additional_info}"
    
    try:
        # Reprocess the call
        result = await supervisor.process_call(raw_transcript=combined_transcript, caller_id=callback_entry["caller_id"])
        
        # Check if it still requires a callback
        if not result.get("requires_callback"):
            CALLBACK_QUEUE.remove(callback_entry)
            CALLBACK_METRICS["total_pending"] -= 1
            CALLBACK_METRICS["total_resolved"] += 1
            await manager.broadcast({"type": "callback_resolved", "payload": {"incident_id": incident_id}})
            result["agent_trail"].append({
                "agent": "system",
                "timestamp": datetime.now(),
                "decision": "Callback Resolution",
                "reasoning": "Location confirmed via callback — upgrading from PENDING to DISPATCHED"
            })
            
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

@app.post("/api/v1/emergency/audio", response_model=EmergencyCallResponse)
async def report_emergency_audio(audio: UploadFile = File(...), caller_id: Optional[str] = Form(None)):
    audio_bytes = await audio.read()
    filename = audio.filename or "audio.wav"
    ext = filename.split(".")[-1].lower() if "." in filename else "wav"
    
    # Process audio with whisper in background thread
    transcription = await asyncio.to_thread(audio_agent.transcribe, audio_bytes, ext)
    transcript_text = transcription.get("transcript", "")
    
    if not transcript_text or transcript_text.startswith("[Transcription Error"):
        raise HTTPException(status_code=400, detail=f"Failed to transcribe audio: {transcript_text}")
        
    try:
        result = await supervisor.process_call(raw_transcript=transcript_text, caller_id=caller_id)
        # Inject metadata for frontend
        result["audio_source"] = "voice_upload"
        result["transcription_confidence"] = transcription.get("confidence")
        
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

@app.post("/api/v1/emergency/report", response_model=EmergencyCallResponse)
async def report_emergency(request: EmergencyCallRequest):
    # Input validation
    if not request.transcript or len(request.transcript.strip()) < 3:
        raise HTTPException(status_code=422, detail="Transcript is too short or empty.")
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
    """Batch simulation runner. Scenarios: normal, flood, prank, fire, accident, medical"""
    scenarios = SimulationScenarios()
    count = max(1, min(count, 20))  # clamp 1-20

    BUILTIN_TRANSCRIPTS = {
        "fire": [
            "Bhai aag lag gayi sector 14 market mein, 3 log fas gaye hain ander!",
            "Fire at Ambience Mall, heavy smoke on third floor, people trapped!",
            "Cylinder blast hua hai DLF ke paas, ek aadmi jal gaya hai, jaldi aao!",
        ],
        "accident": [
            "Mera accident ho gaya NH8 par, mujhe aur dost ko khoon aa raha hai!",
            "Two trucks collided near Iffco Chowk, driver unconscious, help needed.",
            "Teen gaadiya takra gayi Sector 29 chowk pe, 4 log ghaayal hain!",
        ],
        "medical": [
            "Heart attack aa gaya hai meri maa ko, saans nahi le rahi, Sector 18.",
            "Chest pain and breathlessness, patient unconscious, Nehru Place.",
            "Meri biwi ko labor pain ho raha hai, raste mein hain, ambulance bhejo!",
        ],
    }

    if scenario in BUILTIN_TRANSCRIPTS:
        selected = BUILTIN_TRANSCRIPTS[scenario]
        # Cycle through transcripts if count > available
        incidents_to_run = [selected[i % len(selected)] for i in range(count)]
        for transcript in incidents_to_run:
            asyncio.create_task(process_simulated_incident(transcript))
        return {"queued": count, "scenario": scenario}

    if scenario == "normal":
        incidents = scenarios.normal_load()[:count]
    elif scenario == "flood":
        incidents = scenarios.disaster_flood()[:count]
    elif scenario == "prank":
        incidents = scenarios.prank_storm()[:count]
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario '{scenario}'. Valid: normal, flood, prank, fire, accident, medical",
        )

    for incident in incidents:
        asyncio.create_task(process_simulated_incident(incident["transcript"]))

    return {"queued": len(incidents), "scenario": scenario}


async def process_simulated_incident(transcript: str):
    try:
        result = await supervisor.process_call(transcript)
        await publish_result(result)
    except Exception as exc:
        print(f"Simulation error: {exc}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
