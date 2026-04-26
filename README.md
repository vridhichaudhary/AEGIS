# 🚨 AEGIS — AI Emergency Grid & Intelligent Dispatch System

<div align="center">

![AEGIS](https://img.shields.io/badge/AEGIS-AI%20Emergency%20Dispatch-red?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)
![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-orange?style=for-the-badge)

**A real-time, AI-powered emergency dispatch system for Delhi NCR smart cities.**  
Processes 112 emergency calls in Hindi, English, and Hinglish — triages, deduplicates, and dispatches the nearest resource within seconds.

[🌐 Live Demo](https://aegis-mauve-six.vercel.app) · [📡 API](https://aegis-5lpx.onrender.com/docs)

</div>

---

## 🎯 What is AEGIS?

AEGIS is a **Smart City Emergency Dispatch System** built for the scenario where emergency call centers are overwhelmed during a natural disaster or mass casualty event. It uses a **swarm of AI agents** to:

- 📞 Ingest panicked, unstructured emergency calls in **Hindi/English/Hinglish**
- 🗺️ Extract location, severity, and incident type — even from broken sentences
- 🔁 Detect and **merge duplicate calls** for the same event
- ⚡ Assign priority **P1–P5** and dispatch the **nearest available resource**
- 🏥 Route ambulances to the **best-fit hospital** based on specialty and bed availability
- 🧠 Predict cascade disasters using pattern analysis
- 📊 Generate NDMA-compliant After-Action Reports

---

## 🏗️ System Architecture

```
Citizen / WhatsApp / Voice
         │
         ▼
   FastAPI Backend (REST + WebSocket)
         │
         ▼
┌─────────────────────────────────────────┐
│         SupervisorAgent (LangGraph)      │
│                                          │
│  Ingestion → Parsing → Deduplication    │
│     → Validation → Triage → Dispatch    │
│              → Feedback                  │
└─────────────────────────────────────────┘
         │
         ▼
   SQLite (Persistence) + In-Memory State
         │
         ▼
   WebSocket Broadcast → React Frontend
```

The backend runs as a **LangGraph state machine** — each agent is a node that reads and writes to a shared `AgentState` dictionary. The flow is strictly sequential for data integrity, but the entire pipeline completes in **< 2 seconds**.

---

## 🤖 Agent Registry — All 12 Agents Explained

### 1. 🧹 IngestionAgent
**File:** `agents/ingestion_agent.py`

The first node in the pipeline. Receives raw text from any channel (voice, web form, WhatsApp).

**What it does:**
- Normalizes Unicode characters, smart quotes, and whitespace
- Detects language: `en` (English), `hi` (Devanagari Hindi), `hi-en` (Hinglish/Romanized Hindi)
- Uses a set of ~35 Hinglish marker words (`aag`, `behosh`, `bachao`, `gaadi`, etc.) to identify mixed-language calls

**Output:** `normalized_text`, `language_code`

---

### 2. 🗺️ ParsingAgent
**File:** `agents/parsing_agent.py`

The intelligence core. Extracts structured data from free-form emergency text.

**What it does:**
1. **Location Extraction** — Two-stage:
   - *Stage 1*: Direct lookup in a 100+ entry geocoder dictionary (Delhi NCR landmarks, malls, hospitals, sectors, metro stations). Longest-match first.
   - *Stage 2*: Regex patterns for Sector numbers, highways, and landmark suffixes. Strips Hindi postpositions (`mai`, `mein`, `pe`, `ke`) before matching.
2. **Geocoding** — Maps location names to GPS coordinates using `IndianGeocoder`. Falls back to Sector grid math for unknown sector numbers.
3. **Incident Classification** — Pattern-based scoring across 5 categories: `fire`, `medical`, `accident`, `natural_disaster`, `violence`.
4. **Victim Count Extraction** — Parses both digit numbers and Hindi number words (`do`, `teen`, `char`...).
5. **Severity Clues** — Detects critical terms: `trapped`, `behosh`, `saans nahi`, `ghayal`, `bleeding`, etc.
6. **Callback Detection** — If no location is found, sets `requires_callback=True` and generates a follow-up question.
7. **LLM Enhancement** — If Groq/Gemini is available, uses the LLM for higher-accuracy extraction; falls back to heuristics automatically.

**Output:** `location`, `incident_type`, `victim_count`, `severity_clues`, `requires_callback`

---

### 3. 🔁 DeduplicationAgent
**File:** `agents/dedup_agent.py`

Prevents double-dispatch when multiple callers report the same event.

**What it does:**
- Maintains an in-memory store of all incidents from the **last 30 minutes**
- For each new call, finds **candidate incidents** within:
  - ✅ **1.0 km radius** (Haversine distance)
  - ✅ **15-minute time window**
- Computes **semantic similarity** using:
  - `paraphrase-multilingual-MiniLM-L12-v2` embeddings (when available)
  - `fuzzywuzzy` token-sort ratio as lightweight fallback
- Normalizes Hinglish text before comparison (`aag` → `fire`, `behosh` → `unconscious`, etc.)
- **Threshold:** Similarity ≥ 0.75 → duplicate
- When a duplicate is detected:
  - The **original incident** gets `merged_count++`
  - The duplicate is marked `merged_duplicate` and filtered from the active queue
  - Control room shows **"+N Merged"** badge on the original

**Output:** `is_duplicate`, `duplicate_of`, `duplicate_confidence`

---

### 4. ✅ ValidationAgent
**File:** `agents/validation_agent.py`

Detects prank/hoax calls to protect resources from misuse.

**What it does:**
- **LLM Mode:** Scores the call on linguistic distress markers, geographical plausibility, consistency of details (8-second timeout)
- **Rule-Based Fallback:** Starts at 70 points and adjusts based on:
  - ➕ Genuine distress language (`please`, `bachao`, `jaldi`)
  - ➕ Specific location provided
  - ➕ Plausible victim count (1–20)
  - ➕ Detailed description (> 15 words)
  - ➖ Victim count > 100
  - ➖ Call shorter than 5 words
  - ➖ Hoax terms (`haha`, `prank`, `mazak`, `fake`)
  - ➖ Excessive punctuation
- Score < 45 → `REVIEW` flag, dispatch held
- Score < 70 → `INVESTIGATE` flag

**Output:** `confidence_score`, `validation_flags`

---

### 5. 🚦 TriageAgent
**File:** `agents/triage_agent.py`

Assigns priority (P1–P5) and selects the correct resources to dispatch.

**Priority Scale:**
| Priority | Label | Example |
|----------|-------|---------|
| **P1** | CRITICAL | Fire with entrapment, cardiac arrest, active shooter |
| **P2** | SERIOUS | Fire without entrapment, severe injury |
| **P3** | MODERATE | Minor accident, small medical emergency |
| **P4** | MINOR | Non-urgent, single-victim minor incident |
| **P5** | NON-EMERGENCY | Informational, prank |

**Resource dispatch logic:**
- `fire + trapped` → **fire_truck_rescue + ambulance_trauma**
- `cardiac / unconscious` → **ambulance_cardiac**
- `accident (major)` → **ambulance_trauma + police**
- `accident (minor)` → **ambulance + police**
- `violence (weapon)` → **police + ambulance_trauma**
- `flood / building collapse` → **rescue_team + ambulance**
- `fire` → **fire_truck**
- `medical` → **ambulance**

Also sets the **60-minute Golden Hour deadline** for P1/P2 incidents.

**LLM Mode:** Uses Groq/Gemini for novel/unknown emergency types with the full reasoning prompt.

**Output:** `priority`, `resource_requirements`, `golden_hour_deadline`, `golden_hour_at_risk`

---

### 6. 🚑 DispatchAgent
**File:** `agents/dispatch_agent.py`

Routes the right vehicles to the incident using real-world distances.

**What it does:**
1. **Nearest-Available Lookup:** Calls `find_nearest_available(resource_type, lat, lng)` from `state/hospitals.py` — sorts all available units of the required type by **Haversine distance**, returns closest first.
2. **Unit Assignment:** Assigns units to the incident ID (`_unit_assignments` dict), marking them as `dispatched`.
3. **ETA Calculation:** Uses resource-type speed constants (ambulance: 40 km/h, fire truck: 35 km/h, police: 45 km/h). Falls back to OSRM routing API when available for road-accurate ETAs.
4. **Hospital Routing:** For ambulance dispatches, scores hospitals by distance AND available beds:
   - `score = distance / max(available_beds, 0.1)` → lower is better
   - Filters by specialty (cardiac, trauma, burn)
   - Issues **DIVERSION ALERT** if nearest hospital is at capacity
5. **Priority Preemption:** Higher-priority incidents can recall units from lower-priority calls.
6. **Callback Handling:** If `requires_callback=True`, returns `PENDING_INFO` status without dispatching.

**Output:** `assigned_resources` (with ETA, distance, depot name, route geometry), `dispatch_status`, `destination_hospital`

---

### 7. 📚 FeedbackAgent
**File:** `agents/feedback_agent.py`

The continuous learning loop. Runs at the end of every pipeline execution.

**What it does:**
- Logs incident outcome to SQLite (`patterns` table)
- Calculates **triage accuracy** by comparing predicted vs actual priority
- When enough patterns accumulate, runs LLM analysis to:
  - Identify systemic patterns (e.g., "P1 accidents at CP always need 2 ambulances")
  - Generate rule improvement suggestions
  - Track golden hour performance trends
- Stores insights in the `insights` table for the admin dashboard

**Output:** Updates `agent_trail` with feedback notes; persists learning patterns to DB

---

### 8. 🌊 CascadePredictionAgent
**File:** `agents/cascade_agent.py`

**Background service** — runs every 60 seconds independently of the main pipeline.

**What it does:**
- Analyzes all **active incidents** from the last 15 minutes
- Identifies geographic clustering and temporal escalation patterns
- Uses LLM to predict:
  - **Risk Zones:** Areas likely to have new incidents
  - **Cascade Predictions:** What secondary emergencies may emerge (e.g., flooding leads to electrocution)
  - **Pre-positioning Orders:** Which resources to move NOW for predicted future incidents
  - **Threat Level:** LOW / MEDIUM / HIGH / CRITICAL
- Triggers **MCI Agent** if predictions exceed 85% confidence

**Output:** Broadcasts `threat_intelligence` event to all WebSocket clients → displayed in the Threat Intel panel

---

### 9. 🏥 MCIAgent (Mass Casualty Incident)
**File:** `agents/mci_agent.py`

**Activates when** the system detects a mass casualty event (triggered by 3 criteria):
- 3+ incidents within 1 km in 5 minutes
- 2+ P1 incidents in 3 minutes
- 15+ total victims in 10 minutes
- Cascade prediction confidence > 85%

**What it does:**
- Generates **NDMA-compliant MCI Protocol:**
  - Mutual aid requests from adjacent districts
  - NGO ambulance network activation (St. John, Red Cross)
  - Hospital mass casualty plan activation alert
  - Resource gap analysis
  - Public media advisory draft
- On resolution, generates a formal **After-Action Report (AAR):**
  - Incident timeline
  - Resource deployment efficiency
  - Response time vs NDMA targets
  - Golden hour performance
  - Improvement recommendations

---

### 10. 🎙️ AudioIngestionAgent
**File:** `agents/audio_agent.py`

Handles voice/audio emergency calls submitted as audio files.

**What it does:**
- Accepts audio file uploads via the `/api/v1/emergency/audio` endpoint
- Transcribes speech to text
- Feeds the transcript into the main pipeline

---

### 11. 🖼️ ImageAnalysisAgent
**File:** `agents/image_analysis_agent.py`

Processes emergency images submitted via WhatsApp or the web interface.

**What it does:**
- Analyzes incoming images using LLM vision capabilities
- Generates a text description of what it sees (e.g., "Building on fire, heavy smoke visible, people on roof")
- Feeds the description as the transcript into the main pipeline

---

### 12. 🗣️ CommandAgent
**File:** `agents/command_agent.py`

Natural language voice command interface for the control room.

**What it does:**
- Processes operator voice commands like:
  - *"AEGIS, how many critical incidents are active?"*
  - *"AEGIS, what is the status of the fire at Connaught Place?"*
  - *"AEGIS, redirect AMB-101 to Rohini"*
- Queries the live `active_incidents` state
- Returns human-readable responses to the operator dashboard

---

### 13. 📝 ReportAgent
**File:** `agents/report_agent.py`

Generates formal incident reports on demand.

**What it does:**
- Analyzes up to 30 most-recent incidents
- Produces an NDMA-format After-Action Report covering:
  - Total incidents by type and priority
  - Resource utilization
  - Golden hour compliance rate
  - Recommendations

---

## 🗄️ Data Model

### Resource Depots (`state/hospitals.py`)
15 depots across Delhi NCR with real-world coordinates:
- **5 Ambulance Bases** (AIIMS, Safdarjung, GTB, Gurgaon EMS, Noida EMS)
- **5 Fire Stations** (Connaught Place, Rohini, Lajpat Nagar, Gurgaon Sector 14, Noida Sector 58)
- **6 Police Stations** (Delhi HQ, Rohini, Lajpat Nagar, Gurgaon Sadar, Noida Sector 20, Janakpuri)
- **1 NDRF Base** (Noida)

Each unit has `available/dispatched` state managed in memory and persisted to SQLite.

### Hospital Network
8 hospitals with real-time bed availability, specialty matching (trauma/cardiac/burn/ortho), and automatic diversion alerts.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.11) |
| **AI Orchestration** | LangGraph (State Machine) |
| **LLMs** | Groq (Llama-3) + Google Gemini 1.5 Flash |
| **NLP Fallback** | fuzzywuzzy + regex (no heavy ML) |
| **Database** | SQLite (via built-in `db` module) |
| **Real-time** | WebSocket (FastAPI native) |
| **Routing** | OSRM (Open Source Routing Machine) with Haversine fallback |
| **Frontend** | React 18 + Vite |
| **Mapping** | Leaflet.js |
| **Styling** | Tailwind CSS + custom design system |
| **Deployment** | Render (backend) + Vercel (frontend) |

---

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
# Clone the repo
git clone https://github.com/vridhichaudhary/AEGIS.git
cd AEGIS

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env — add GROQ_API_KEY and/or GOOGLE_API_KEY

# Start backend
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd portal
npm install

# Configure API endpoint
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
echo "VITE_WS_URL=ws://localhost:8000/ws" >> .env.local

npm run dev
# Visit http://localhost:5173
```

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/emergency/report` | Submit emergency transcript |
| `POST` | `/api/v1/emergency/audio` | Submit audio file |
| `WS` | `/ws` | Real-time event stream |
| `GET` | `/api/v1/hospitals` | Live hospital bed availability |
| `GET` | `/api/v1/resources` | Live fleet status + depot locations |
| `GET` | `/api/v1/callbacks` | Pending callback queue |
| `POST` | `/api/v1/incidents/{id}/resolve` | Resolve + release resources |
| `GET` | `/api/v1/report/generate` | Generate After-Action Report |
| `POST` | `/api/v1/command` | Voice command processing |

---

## 🎥 Demo Script (Hackathon Presentation)

The `/api/v1/demo/start` endpoint runs a scripted 8-act demo:

| Act | Scenario | Feature Shown |
|-----|----------|---------------|
| 1 | Fire at Connaught Place | English triage + P1 dispatch |
| 2 | `"bhai mere ghar mein aag lag gayi..."` | Hindi/Hinglish parsing |
| 3 | Second fire call near CP | **Duplicate detection + merge** |
| 4 | Vague location call | **Callback queue + AI follow-up** |
| 5 | Flood surge in Sector 14–16 | **Cascade Prediction activation** |
| 6 | Bus overturned in flood | **MCI Protocol trigger** |
| 7 | Voice command to AEGIS | **CommandAgent response** |
| 8 | Resolve incident | **Resource release + AAR generation** |

---

## 🗺️ UI Panels

### 🔴 SOS Portal (Citizen View)
- Voice input (Hindi/English) via browser SpeechRecognition
- Real-time status track: `Received → Parsing → Triaged → Dispatched`
- Closest responder card — category-aware (ambulance for accidents, fire for fires)
- Tactical deployment map with directional vectors to responders
- Nearby response centers with distance and ETA

### ⚪ Control Room (Admin Dashboard)
- Live priority queue with P1–P5 labels (CRITICAL / SERIOUS / MODERATE / MINOR / NON-EMERGENCY)
- "+N Merged" badges on deduplicated incidents
- Real-time map with incident markers and dispatch routes
- Hospital capacity grid (beds + specialties, color-coded status)
- Active fleet monitor with per-unit status
- Agent activity feed (live reasoning trail)
- Threat Intelligence panel (cascade predictions)
- MCI Protocol modal with NDMA response plan

---

## 👥 Contributing

Contributions are welcome. Please open an issue first to discuss major changes.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built for **Smart City Hackathon 2025**  
*"Saving lives with AI — one call at a time"*

</div>