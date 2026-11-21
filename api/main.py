import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Literal, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile, Form, Query
import random
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.supervisor import SupervisorAgent
from agents.base_agent import BaseAgent
from agents.cascade_agent import CascadePredictionAgent
from agents.command_agent import CommandAgent
from agents.report_agent import ReportAgent
from agents.audio_agent import AudioIngestionAgent
from config.settings import settings
from simulation.scenarios import SimulationScenarios
import db.database as db

try:
    import multipart  # noqa: F401
    MULTIPART_AVAILABLE = True
except ImportError:
    MULTIPART_AVAILABLE = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = await startup_event()
    try:
        yield
    finally:
        if DEMO_TASK:
            tasks.append(DEMO_TASK)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="AEGIS API", version="1.0.0", lifespan=lifespan)

# CORS Setup
origins = [
    "https://aegis-mauve-six.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    *[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
from agents.mci_agent import MCIAgent
from agents.image_analysis_agent import ImageAnalysisAgent
from state.hospitals import HOSPITALS, assign_unit, get_depot_status, get_fleet_status, haversine_distance
active_incidents: Dict[str, dict] = {}
CALLBACK_QUEUE: List[dict] = []
CALLBACK_METRICS = {"total_pending": 0, "total_resolved": 0}

mci_agent = MCIAgent()
image_analysis_agent = ImageAnalysisAgent()
MCI_STATE = {
    "active": False,
    "zone": None,
    "details": None
}
MCI_INCIDENT_IDS: set[str] = set()
LATEST_THREAT_INTEL = None
DEMO_TASK = None
INCIDENT_UPDATES_IN_PROGRESS: set[str] = set()

DEMO_SCRIPT = [
    {
        "act": 1,
        "name": "Initial Triage (English)",
        "delay": 0,
        "transcripts": ["Fire at Connaught Place, 2 people trapped and smoke filling the corridor"],
        "notes": "Showing baseline English triage. Note the high-confidence priority assignment (P1)."
    },
    {
        "act": 2,
        "name": "Bilingual Support (Hindi)",
        "delay": 30,
        "transcripts": ["bhai mere ghar mein aag lag gayi hai, main Rohini Sector 11 mein hoon, jaldi aao, bache bhi hain!"],
        "notes": "Processing raw Hindi/Hinglish. System automatically geocodes Rohini and assigns high priority."
    },
    {
        "act": 3,
        "name": "Duplicate Detection",
        "delay": 30,
        "transcripts": ["There is a fire near Connaught Place metro station, lots of smoke!"],
        "notes": "Duplicate caller detected. System merges the incident to prevent resource double-dispatch."
    },
    {
        "act": 4,
        "name": "Callback Intelligence",
        "delay": 30,
        "transcripts": ["someone is hurt, please help, I am near the big park"],
        "notes": "Missing exact location. Incident placed in Callback Queue. AI suggested script generated."
    },
    {
        "act": 5,
        "name": "Flood Surge Prediction",
        "delay": 30,
        "transcripts": [
            "Heavy water flooding Sector 14 market, cars floating",
            "Building basement flooding in Sector 15, electricity sparking",
            "Stuck in water at Sector 16 underpass",
            "Tree fallen on house due to heavy rain in Sector 14"
        ],
        "notes": "Rapid influx from single area triggers Cascade Prediction Agent. Threat Intelligence panel activates."
    },
    {
        "act": 6,
        "name": "MCI Threshold",
        "delay": 45,
        "transcripts": ["Bus overturned in Sector 14 flood, many casualties!"],
        "notes": "MCI Threshold crossed. System-wide protocol activation. Dashboard shifts to emergency mode."
    },
    {
        "act": 7,
        "name": "Voice Command Demo",
        "delay": 45,
        "command": "AEGIS, how many critical incidents are active?",
        "notes": "Operational control via voice. Supervisor queries memory and returns live operational count."
    },
    {
        "act": 8,
        "name": "Resolution & AAR",
        "delay": 45,
        "action": "resolve_first",
        "notes": "Marking first incident resolved. Resources released. NDMA-format After-Action Report auto-generated."
    }
]

async def run_demo_loop(speed: float = 1.0):
    global DEMO_TASK
    try:
        first_incident_id = None
        demo_callback_id = None
        for step in DEMO_SCRIPT:
            # Respect speed for delay
            if step["delay"] > 0:
                await asyncio.sleep(step["delay"] / speed)
            
            await manager.broadcast({
                "type": "demo_step",
                "payload": {
                    "act": step["act"],
                    "name": step["name"],
                    "notes": step["notes"]
                }
            })

            # Handle Transcripts
            if "transcripts" in step:
                for t in step["transcripts"]:
                    result = await supervisor.process_call(t, channel="simulation")
                    await publish_result(result)
                    if step["act"] == 1:
                        first_incident_id = result.get("duplicate_of") or result["incident_id"]
                    if step["act"] == 4 and result["dispatch_status"] == "awaiting_location":
                        demo_callback_id = result["incident_id"]
                    # Add small jitter between batch calls
                    await asyncio.sleep(2 / speed)
            
            # Handle Callback Simulation (Act 4)
            if step["act"] == 4:
                await asyncio.sleep(10 / speed)
                if demo_callback_id and any(entry["incident_id"] == demo_callback_id for entry in CALLBACK_QUEUE):
                    await process_callback_response(
                        demo_callback_id, CallbackResponseRequest(additional_info="I am at Connaught Place, New Delhi."),
                    )

            # Handle Commands (Act 7)
            if "command" in step:
                await manager.broadcast({"type": "voice_demo_trigger", "payload": step["command"]})
                await asyncio.sleep(2 / speed)
                res = await process_voice_command(CommandAgentRequest(command=step["command"]))
                await manager.broadcast({"type": "voice_demo_response", "payload": res["spoken_response"]})

            # Handle Actions (Act 8)
            if step.get("action") == "resolve_first" and first_incident_id:
                await resolve_incident(first_incident_id)
                # Simulate AAR generation
                aar = await generate_aar()
                await manager.broadcast({"type": "demo_aar_preview", "payload": aar})

        await manager.broadcast({"type": "demo_complete", "payload": {}})
    except Exception as e:
        print(f"Demo Error: {e}")
    finally:
        DEMO_TASK = None

async def proactive_threat_loop():
    while True:
        await asyncio.sleep(60)
        cutoff = datetime.now().timestamp() - 900
        recent = [incident for incident in current_incidents()
                  if datetime.fromisoformat(incident["timestamp"]).timestamp() >= cutoff]
        if recent:
            try:
                intel = await cascade_agent.analyze(recent)
                if intel:
                    global LATEST_THREAT_INTEL
                    LATEST_THREAT_INTEL = intel
                    await manager.broadcast({"type": "threat_intelligence", "payload": intel})
            except Exception as e:
                print(f"Error in threat loop: {e}")

async def hospital_bed_fluctuation_loop():
    """Background task to simulate real-time hospital bed availability."""
    while True:
        await asyncio.sleep(60)
        
        updates = []
        for h in HOSPITALS:
            # Fluctuate beds by -2 to +2, ensuring it stays between 0 and trauma_beds limit
            delta = random.randint(-2, 2)
            old_beds = h["available"]
            h["available"] = max(0, min(h["trauma_beds"], h["available"] + delta))
            
            if old_beds != h["available"]:
                updates.append(h)
                
            if h["available"] == 0 and old_beds > 0:
                # Trigger diversion alert
                # Find an alternative with beds
                alts = [alt for alt in HOSPITALS if alt["available"] > 0 and alt["id"] != h["id"]]
                alt_name = alts[0]["name"] if alts else "any other facility"
                
                await manager.broadcast({
                    "type": "system_alert",
                    "payload": {
                        "level": "critical",
                        "title": "HOSPITAL DIVERSION ALERT",
                        "message": f"DIVERSION: {h['name']} at capacity (0 beds) — redirect incoming to {alt_name}."
                    }
                })
        
        if updates:
            await manager.broadcast({
                "type": "hospital_update",
                "payload": HOSPITALS
            })

async def startup_event():
    # Initialize SQLite database
    db.init_db()
    
    for incident in reversed(db.get_all_incidents(limit=-1, active_only=True)):
        incident_id = incident["incident_id"]
        active_incidents[incident_id] = incident
        if incident.get("requires_callback") and incident["dispatch_status"] == "awaiting_location":
            CALLBACK_QUEUE.append(callback_for(incident))
        if (incident.get("location") or {}).get("source") in {"shared_pin", "operator_pin", "gazetteer"}:
            for unit in incident.get("assigned_resources", []):
                assign_unit(unit["resource_id"], incident_id, incident["priority"])
            if incident.get("incident_type", {}).get("category") != "other" and incident["dispatch_status"] not in {"review_required", "not_required", "awaiting_location"}:
                supervisor.dedup.store_incident(
                    incident_id, incident.get("transcript", ""), incident["incident_type"]["category"],
                    incident["location"]["latitude"], incident["location"]["longitude"],
                    datetime.fromisoformat(incident["timestamp"]), None,
                )
    CALLBACK_METRICS["total_pending"] = len(CALLBACK_QUEUE)

    return [
        asyncio.create_task(proactive_threat_loop()),
        asyncio.create_task(hospital_bed_fluctuation_loop()),
        asyncio.create_task(mci_surge_detector_loop()),
    ]

async def mci_surge_detector_loop():
    """Background task to detect Mass Casualty Incidents."""
    global MCI_STATE
    while True:
        await asyncio.sleep(30)
        
        recent_incidents = []
        now = datetime.now()
        for inc in current_incidents():
            if inc.get("timestamp"):
                try:
                    ts = datetime.fromisoformat(inc["timestamp"])
                    if (now - ts).total_seconds() <= 600: # last 10 mins
                        recent_incidents.append(inc)
                except ValueError:
                    pass
        
        trigger = False
        zone = "Unknown Region"

        if recent_incidents:
            # 1. 3+ incidents within 1km radius in last 5 minutes
            recent_5m = [i for i in recent_incidents if (now - datetime.fromisoformat(i["timestamp"])).total_seconds() <= 300]
            for i, inc1 in enumerate(recent_5m):
                cluster_count = 1
                lat1 = inc1.get("location", {}).get("latitude")
                lng1 = inc1.get("location", {}).get("longitude")
                if lat1 is None or lng1 is None: continue
                
                for inc2 in recent_5m[i+1:]:
                    lat2 = inc2.get("location", {}).get("latitude")
                    lng2 = inc2.get("location", {}).get("longitude")
                    if lat2 is None or lng2 is None: continue
                    dist = haversine_distance(lat1, lng1, lat2, lng2)
                    if dist <= 1.0:
                        cluster_count += 1
                if cluster_count >= 3:
                    trigger = True
                    zone = inc1.get("location", {}).get("raw_text", "Clustered Area")
                    break

            # 2. 2+ P1 incidents in last 3 mins
            if not trigger:
                recent_3m_p1 = [i for i in recent_incidents if i.get("priority") == "P1" and (now - datetime.fromisoformat(i["timestamp"])).total_seconds() <= 180]
                if len(recent_3m_p1) >= 2:
                    trigger = True
                    zone = recent_3m_p1[0].get("location", {}).get("raw_text", "Critical Zone")

            # 3. Victim count > 15 in last 10 mins
            if not trigger:
                total_victims = sum(int(i.get("victim_count", 0) or 0) for i in recent_incidents)
                if total_victims >= 15:
                    trigger = True
                    zone = "Regional Zone"

        if trigger:
            MCI_INCIDENT_IDS.update(incident["incident_id"] for incident in recent_incidents)

        if trigger and not MCI_STATE["active"]:
            MCI_STATE["active"] = True
            MCI_STATE["zone"] = zone
            free = [unit for unit in get_fleet_status() if unit["status"] == "available"]
            resources = {
                "ambulances_available": sum(unit["type"].startswith("ambulance") for unit in free),
                "fire_trucks_available": sum(unit["type"].startswith("fire") for unit in free),
            }
            mci_response = await mci_agent.generate_mci_response(zone, len(recent_incidents), resources)
            MCI_STATE["details"] = mci_response
            await manager.broadcast({"type": "mci_activation", "payload": {"zone": zone, "details": mci_response}})
            
        elif not trigger and MCI_STATE["active"]:
            # MCI Resolved - Generate AAR
            current_zone = MCI_STATE["zone"]
            records = [active_incidents[incident_id] for incident_id in MCI_INCIDENT_IDS if incident_id in active_incidents]
            aar_report = await mci_agent.generate_aar_report(current_zone, records)
            MCI_INCIDENT_IDS.clear()
            MCI_STATE["active"] = False
            MCI_STATE["details"] = None
            await manager.broadcast({"type": "mci_resolved", "payload": {"zone": current_zone, "aar_report": aar_report}})


class LocationPin(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class EmergencyCallRequest(BaseModel):
    transcript: str = Field(min_length=3, max_length=4000)
    caller_id: Optional[str] = None
    location: Optional[LocationPin] = None
    model_config = {"str_strip_whitespace": True}


class CommandAgentRequest(BaseModel):
    command: str = Field(min_length=1, max_length=500)
    language: str = "en-US"


class CallbackResponseRequest(BaseModel):
    candidate_index: Optional[int] = Field(default=None, ge=0, le=4)
    additional_info: str = Field(default="", max_length=2000)
    location: Optional[LocationPin] = None


class OperatorReviewRequest(BaseModel):
    category: Literal["fire", "medical", "accident", "natural_disaster", "violence"]


class WhatsAppTextBody(BaseModel):
    body: str = Field(max_length=4000)


class WhatsAppMessage(BaseModel):
    sender: str = Field(default="Unknown", alias="from")
    type: Literal["text", "location", "image"] = "text"
    text: Optional[WhatsAppTextBody] = None
    location: Optional[LocationPin] = None
    image: Optional[dict] = None


class EmergencyCallResponse(BaseModel):
    incident_id: str
    status: str
    priority: str
    assigned_resources: List[dict]
    eta_minutes: Optional[float]
    dispatch_status: str
    incident_status: Optional[str] = None
    location: Optional[dict] = None
    incident_type: Optional[dict] = None
    requires_callback: Optional[bool] = None
    missing_fields: Optional[List[str]] = None
    suggested_callback_script: Optional[str] = None
    channel: Optional[str] = None
    agent_trail: List[dict]
    destination_hospital: Optional[dict] = None
    hospital_warning: Optional[str] = None
    resource_shortfall: List[dict] = Field(default_factory=list)
    transcript: str = ""
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
        "status": "merged_duplicate" if result.get("is_duplicate") else result.get("incident_status", "PENDING"),
        "incident_status": result.get("incident_status"),
        "dispatch_status": result.get("dispatch_status", "pending"),
        "timestamp": result["timestamp"].isoformat(),
        "location": result.get("location"),
        "victim_count": result.get("victim_count", 0),
        "eta_minutes": min((unit["eta_minutes"] for unit in result.get("assigned_resources", [])), default=None),
        "resource_shortfall": result.get("resource_shortfall", []),
        "validation_flags": result.get("validation_flags", []),
        "agent_trail": [
            {**event, "timestamp": event["timestamp"].isoformat()} for event in result.get("agent_trail", [])
        ],
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
        "destination_hospital": result.get("destination_hospital"),
        "hospital_warning": result.get("hospital_warning"),
        "channel": result.get("channel", "voice_call"),
    }


def current_incidents():
    return [incident for incident in active_incidents.values()
            if incident["status"] != "RESOLVED" and not incident.get("is_duplicate")]


def callback_for(incident: dict, attempts: int = 1) -> dict:
    return {
        "caller_id": "Unknown",
        "incident_id": incident["incident_id"],
        "transcript": incident.get("transcript", ""),
        "missing_fields": incident.get("missing_fields", []),
        "suggested_question": incident.get("suggested_callback_script"),
        "created_at": incident["timestamp"],
        "attempts": attempts,
    }


def response_for(incident):
    return {**incident, "status": "processed"}


async def publish_result(result: dict):
    """Persist the decision before broadcasting it to clients."""
    if result["dispatch_status"] == "pending":
        raise HTTPException(status_code=503, detail="Incident processing could not be completed.")
    incident = serialize_incident(result)
    new_events = incident["agent_trail"]
    incident_id = incident["incident_id"]
    previous = active_incidents.get(incident_id, {})
    incident["timestamp"] = previous.get("timestamp", incident["timestamp"])
    incident["merged_count"] = previous.get("merged_count", 1)
    incident["agent_trail"] = previous.get("agent_trail", []) + incident["agent_trail"]

    parent = active_incidents.get(incident.get("duplicate_of")) if incident["is_duplicate"] else None
    if parent and parent.get("status") != "RESOLVED":
        parent = {**parent, "merged_count": parent.get("merged_count", 1) + 1}
    else:
        parent = None
    try:
        db.save_incidents(incident, parent) if parent else db.save_incident(incident)
    except Exception:
        await supervisor.dispatch.release_resources(incident_id)
        supervisor.dedup.forget(incident_id)
        raise
    if parent:
        active_incidents[parent["incident_id"]] = parent
    active_incidents[incident_id] = incident

    queued = next((entry for entry in CALLBACK_QUEUE if entry["incident_id"] == incident_id), None)
    if queued:
        CALLBACK_QUEUE.remove(queued)
    if incident["requires_callback"] and incident["dispatch_status"] == "awaiting_location":
        entry = callback_for(incident, queued["attempts"] + 1 if queued else 1)
        CALLBACK_QUEUE.append(entry)
    elif queued:
        CALLBACK_METRICS["total_resolved"] += 1
    CALLBACK_METRICS["total_pending"] = len(CALLBACK_QUEUE)

    if parent:
        await manager.broadcast({"type": "incident_update", "payload": parent})
    await manager.broadcast({"type": "incident_update", "payload": incident})
    if result.get("assigned_resources"):
        await broadcast_fleet()
    for event in new_events:
        await manager.broadcast({"type": "agent_event", "payload": {**event, "incident_id": incident_id}})
    return incident


async def broadcast_fleet():
    await manager.broadcast({"type": "resource_update", "payload": await get_resources()})


@app.get("/health")
async def health_check():
    llm_probe = BaseAgent()
    return {
        "status": "healthy",
        "mode": "simulation",
        "timestamp": datetime.now().isoformat(),
        "llm": llm_probe.llm_diagnostics,
        "redis_host": settings.REDIS_HOST,
        "environment": settings.ENVIRONMENT,
    }


@app.post("/api/v1/webhook/whatsapp")
async def whatsapp_webhook(request: WhatsAppMessage):
    """Accept a simulated WhatsApp report and its optional shared pin."""
    transcript = (request.text.body if request.text else "").strip()
    if request.type == "image":
        transcript = await image_analysis_agent.describe(transcript or (request.image or {}).get("caption", ""))
    if len(transcript) < 3:
        raise HTTPException(status_code=422, detail="Provide an incident description or image caption.")
    if request.type == "location" and not request.location:
        raise HTTPException(status_code=422, detail="Location messages require a valid location pin.")

    result = await supervisor.process_call(
        transcript, caller_id=request.sender, channel="whatsapp",
        gps_override=request.location.model_dump() if request.location else None,
    )
    incident = await publish_result(result)
    status = incident["dispatch_status"]
    if status == "awaiting_location":
        detail = incident["suggested_callback_script"]
    elif status in {"assigned", "partially_assigned"}:
        part = "Some units assigned." if status == "partially_assigned" else "Simulated units assigned."
        detail = f"{part} First estimated arrival: {incident['eta_minutes']:g} minutes."
    elif status == "merged_duplicate":
        detail = f"Linked to report #{incident['duplicate_of'][:8].upper()}."
    else:
        detail = f"Current status: {status.replace('_', ' ')}."
    return {**incident, "whatsapp_reply": f"Simulation report #{incident['incident_id'][:8].upper()}. {detail}"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "snapshot", "payload": {
            "incidents": list(active_incidents.values()), **await get_resources(),
            "hospitals": HOSPITALS, "mci": MCI_STATE, "threat_intel": LATEST_THREAT_INTEL,
        }})
        while True:
            message = await websocket.receive_text()
            if message:
                try:
                    if "ping" in message:
                        await websocket.send_json({"type": "pong", "ts": datetime.now().isoformat()})
                except Exception:
                    pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@app.post("/api/v1/command")
async def process_voice_command(request: CommandAgentRequest):
    return await command_agent.process_command(request.command, request.language, current_incidents(), get_fleet_status())


@app.get("/api/v1/report/generate")
async def generate_aar():
    recent = db.get_all_incidents(limit=30)
    report = await report_agent.generate_report(recent)
    if not report:
        raise HTTPException(status_code=400, detail="Submit a simulation report first.")
    return report

@app.post("/api/v1/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    incident = active_incidents.get(incident_id)
    if not incident or incident.get("is_duplicate"):
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident_id in INCIDENT_UPDATES_IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Location update is in progress.")
    if incident["status"] == "RESOLVED":
        return {"status": "success", "resolved_id": incident_id, "freed": 0}

    now = datetime.now().isoformat()
    incident = {
        **incident, "status": "RESOLVED", "incident_status": "RESOLVED",
        "resolved_at": now, "requires_callback": False,
        "agent_trail": [*incident.get("agent_trail", []), {
            "agent": "operator", "timestamp": now, "decision": "Resolved",
            "reasoning": "Operator closed the simulated incident.",
        }],
    }
    db.save_incident(incident)
    active_incidents[incident_id] = incident
    CALLBACK_QUEUE[:] = [entry for entry in CALLBACK_QUEUE if entry["incident_id"] != incident_id]
    CALLBACK_METRICS["total_pending"] = len(CALLBACK_QUEUE)
    supervisor.dedup.forget(incident_id)
    released_ids = await supervisor.dispatch.release_resources(incident_id)
    await manager.broadcast({"type": "incident_update", "payload": incident})
    await manager.broadcast({
        "type": "incident_resolved",
        "payload": {"incident_id": incident_id, "released_resources": released_ids, "freed_count": len(released_ids)},
    })
    await broadcast_fleet()
    await supervisor.feedback.analyze(incident_id, incident, {"outcome": "Closed in simulation"})
    return {"status": "success", "resolved_id": incident_id, "freed": len(released_ids)}


@app.get("/api/v1/learning/insights")
async def get_learning_insights():
    insight = await asyncio.to_thread(db.get_latest_insight)
    return insight or {"patterns_found": [], "rule_suggestions": [], "performance_delta": {}}

@app.post("/api/v1/learning/apply")
async def apply_learning_rule():
    raise HTTPException(status_code=409, detail="Learning suggestions are advisory. Review and update triage rules in the source.")

@app.get("/api/v1/hospitals")
async def get_hospitals():
    return {"hospitals": HOSPITALS}

@app.get("/api/v1/resources")
async def get_resources():
    fleet = get_fleet_status()
    return {"resources": fleet, "depots": get_depot_status(fleet)}


@app.get("/api/v1/incidents/history")
async def get_incident_history(limit: int = Query(50, ge=1, le=500)):
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
    entry = next((entry for entry in CALLBACK_QUEUE if entry["incident_id"] == incident_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Incident not found in callback queue")
    if incident_id in INCIDENT_UPDATES_IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Location update is already in progress.")
    if request.candidate_index is None and not request.location and not request.additional_info.strip():
        raise HTTPException(status_code=422, detail="Provide a confirmed pin or additional location details.")

    previous = active_incidents[incident_id]
    # Prefer the new location statement when the original transcript was ambiguous.
    transcript = f"{request.additional_info.strip()}\n{entry['transcript']}".strip()
    pin = {**request.location.model_dump(), "source": "operator_pin"} if request.location else None
    if request.candidate_index is not None and not request.location:
        candidates = previous.get("location", {}).get("candidates", [])
        if request.candidate_index >= len(candidates) or not candidates[request.candidate_index].get("selectable"):
            raise HTTPException(status_code=422, detail="Select a precise candidate or confirm a map pin.")
        candidate = candidates[request.candidate_index]
        pin = {"latitude": candidate["latitude"], "longitude": candidate["longitude"],
               "source": "operator_pin", "raw_text": candidate["label"]}
    INCIDENT_UPDATES_IN_PROGRESS.add(incident_id)
    try:
        result = await supervisor.process_call(
            transcript, caller_id=entry["caller_id"], incident_id=incident_id,
            channel=previous.get("channel", "voice_call"), gps_override=pin,
        )
        result["agent_trail"].append({
            "agent": "operator", "timestamp": datetime.now(), "decision": "Location follow-up",
            "reasoning": "Location updated from callback evidence." if not result["requires_callback"]
                         else "Location still needs confirmation.",
        })
        return response_for(await publish_result(result))
    finally:
        INCIDENT_UPDATES_IN_PROGRESS.discard(incident_id)


@app.post("/api/v1/incidents/{incident_id}/review", response_model=EmergencyCallResponse)
async def confirm_operator_review(incident_id: str, request: OperatorReviewRequest):
    incident = active_incidents.get(incident_id)
    if not incident or incident["status"] == "RESOLVED":
        raise HTTPException(status_code=404, detail="Incident not found.")
    if incident["dispatch_status"] != "review_required" or incident_id in INCIDENT_UPDATES_IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Incident is not awaiting operator review.")
    location = incident.get("location") or {}
    if location.get("latitude") is None or location.get("longitude") is None:
        raise HTTPException(status_code=409, detail="Complete location follow-up first.")

    INCIDENT_UPDATES_IN_PROGRESS.add(incident_id)
    try:
        result = await supervisor.process_call(
            incident["transcript"], incident_id=incident_id, channel=incident.get("channel", "voice_call"),
            gps_override=location, operator_category=request.category,
        )
        result["agent_trail"].insert(0, {
            "agent": "operator", "timestamp": datetime.now(),
            "decision": "Confirmed incident category",
            "reasoning": f"Operator confirmed {request.category.replace('_', ' ')} for simulated dispatch.",
        })
        return response_for(await publish_result(result))
    finally:
        INCIDENT_UPDATES_IN_PROGRESS.discard(incident_id)


if MULTIPART_AVAILABLE:
    @app.post("/api/v1/emergency/audio", response_model=EmergencyCallResponse)
    async def report_emergency_audio(audio: UploadFile = File(...), caller_id: Optional[str] = Form(None)):
        if not audio_agent.is_loaded:
            raise HTTPException(status_code=503, detail="Audio transcription requires the optional Whisper model.")
        audio_bytes = await audio.read(10 * 1024 * 1024 + 1)
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio uploads are limited to 10 MB.")
        ext = (audio.filename or "audio.wav").rsplit(".", 1)[-1].lower()
        if ext not in {"wav", "mp3", "m4a", "ogg", "webm", "flac", "mp4"}:
            raise HTTPException(status_code=415, detail="Unsupported audio format.")
        transcription = await asyncio.to_thread(audio_agent.transcribe, audio_bytes, ext)
        transcript = transcription.get("transcript", "")
        if len(transcript) < 3 or transcript.startswith("[Transcription Error"):
            raise HTTPException(status_code=422, detail="No usable speech was transcribed.")
        result = await supervisor.process_call(transcript, caller_id, channel="voice_upload")
        return response_for(await publish_result(result))
else:
    @app.post("/api/v1/emergency/audio")
    async def report_emergency_audio_unavailable():
        raise HTTPException(
            status_code=503,
            detail="Audio upload is unavailable because python-multipart is not installed on the server.",
        )

@app.post("/api/v1/emergency/report", response_model=EmergencyCallResponse)
async def report_emergency(request: EmergencyCallRequest):
    result = await supervisor.process_call(
        request.transcript, request.caller_id, channel="sos_portal",
        gps_override=request.location.model_dump() if request.location else None,
    )
    return response_for(await publish_result(result))


@app.get("/api/v1/incidents/active")
async def get_active_incidents():
    return {"incidents": current_incidents()}


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
        result = await supervisor.process_call(transcript, channel="simulation")
        await publish_result(result)
    except Exception as exc:
        print(f"Simulation error: {exc}")


@app.get("/api/v1/demo/start")
async def start_demo(speed: float = Query(1.0, ge=0.5, le=5.0)):
    global DEMO_TASK
    if DEMO_TASK:
        raise HTTPException(status_code=400, detail="Demo already running")
    
    DEMO_TASK = asyncio.create_task(run_demo_loop(speed))
    return {"status": "started", "speed": speed}

@app.post("/api/v1/demo/stop")
async def stop_demo():
    global DEMO_TASK
    if DEMO_TASK:
        DEMO_TASK.cancel()
        await asyncio.gather(DEMO_TASK, return_exceptions=True)
    return {"status": "stopped"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
