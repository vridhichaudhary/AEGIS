import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "aegis.db")

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Incidents Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                transcript TEXT,
                category TEXT,
                location TEXT,
                lat REAL, lng REAL,
                priority TEXT,
                status TEXT DEFAULT 'DISPATCHED',
                assigned_resources TEXT,  -- JSON array
                eta_minutes REAL,
                authenticity_score INTEGER,
                is_duplicate INTEGER DEFAULT 0,
                golden_hour_deadline TEXT,
                golden_hour_at_risk INTEGER DEFAULT 0,
                created_at TEXT,
                resolved_at TEXT,
                agent_trail TEXT  -- JSON array of agent events
            )
        ''')
        
        # Resources Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS resources (
                id TEXT PRIMARY KEY,
                type TEXT,
                name TEXT,
                available INTEGER DEFAULT 1,
                assigned_to TEXT,
                depot_lat REAL,
                depot_lng REAL,
                last_updated TEXT
            )
        ''')
        
        # Metrics Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            )
        ''')
        
        # Patterns Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT,
                incident_type TEXT,
                context TEXT,
                decision TEXT,
                outcome TEXT,
                timestamp TEXT
            )
        ''')

        # Insights Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patterns_found TEXT,
                rule_suggestions TEXT,
                performance_delta TEXT,
                timestamp TEXT
            )
        ''')
        conn.commit()

def save_incident(incident: Dict[str, Any]):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Extract location info safely
        location_data = incident.get("location", {})
        if not isinstance(location_data, dict):
            location_data = {}
        location_text = location_data.get("raw_text", "Unknown")
        lat = location_data.get("latitude")
        lng = location_data.get("longitude")

        # Extract incident type safely
        incident_type = incident.get("incident_type", {})
        if not isinstance(incident_type, dict):
            incident_type = {}
        category = incident_type.get("category", "Unknown")

        cursor.execute('''
            INSERT OR REPLACE INTO incidents (
                id, transcript, category, location, lat, lng, priority, status,
                assigned_resources, eta_minutes, authenticity_score, is_duplicate,
                golden_hour_deadline, golden_hour_at_risk, created_at, resolved_at, agent_trail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            incident.get("incident_id"),
            incident.get("transcript", incident.get("raw_transcript", "")),
            category,
            location_text,
            lat,
            lng,
            incident.get("priority", "P3"),
            incident.get("dispatch_status", incident.get("status", "PENDING")),
            json.dumps(incident.get("assigned_resources", [])),
            incident.get("eta_minutes"),
            incident.get("authenticity_score"),
            1 if incident.get("is_duplicate") else 0,
            incident.get("golden_hour_deadline"),
            1 if incident.get("golden_hour_at_risk") else 0,
            incident.get("timestamp", datetime.now().isoformat()),
            None, # resolved_at is updated when status changes to RESOLVED
            json.dumps(incident.get("agent_trail", []))
        ))
        conn.commit()

def get_all_incidents(limit: int = 100) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?', (limit,))
        rows = cursor.fetchall()
        
        incidents = []
        for row in rows:
            # Reconstruct the incident dictionary structure expected by active_incidents
            incidents.append({
                "incident_id": row["id"],
                "transcript": row["transcript"],
                "incident_type": {"category": row["category"]},
                "location": {"raw_text": row["location"], "latitude": row["lat"], "longitude": row["lng"]},
                "priority": row["priority"],
                "status": row["status"],
                "dispatch_status": row["status"],
                "assigned_resources": json.loads(row["assigned_resources"]) if row["assigned_resources"] else [],
                "eta_minutes": row["eta_minutes"],
                "authenticity_score": row["authenticity_score"],
                "is_duplicate": bool(row["is_duplicate"]),
                "golden_hour_deadline": row["golden_hour_deadline"],
                "golden_hour_at_risk": bool(row["golden_hour_at_risk"]),
                "timestamp": row["created_at"],
                "resolved_at": row["resolved_at"],
                "agent_trail": json.loads(row["agent_trail"]) if row["agent_trail"] else []
            })
        return incidents

def update_incident_status(incident_id: str, status: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        resolved_at = datetime.now().isoformat() if status == "RESOLVED" else None
        
        if resolved_at:
            cursor.execute('''
                UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?
            ''', (status, resolved_at, incident_id))
        else:
            cursor.execute('''
                UPDATE incidents SET status = ? WHERE id = ?
            ''', (status, incident_id))
        conn.commit()

def save_resource_state(resources: List[Dict[str, Any]]):
    with get_connection() as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        for res in resources:
            cursor.execute('''
                INSERT OR REPLACE INTO resources (
                    id, type, name, available, assigned_to, depot_lat, depot_lng, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                res.get("id"),
                res.get("type"),
                res.get("name"),
                1 if res.get("status", "available") == "available" else 0,
                res.get("assigned_to"),
                res.get("depot_lat"),
                res.get("depot_lng"),
                now
            ))
        conn.commit()

def get_metrics() -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        metrics = {}
        
        # Total incidents
        cursor.execute("SELECT COUNT(*) FROM incidents")
        metrics["total_incidents"] = cursor.fetchone()[0]
        
        # Active incidents
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE status != 'RESOLVED' AND status != 'merged_duplicate'")
        metrics["active_incidents"] = cursor.fetchone()[0]
        
        # Hoax calls
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE authenticity_score < 40")
        metrics["hoax_calls"] = cursor.fetchone()[0]
        
        # Golden hour success (P1/P2 resolved successfully within time)
        # For simplicity in SQL, we'll just query P1/P2 that didn't fail golden hour
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE priority IN ('P1', 'P2') AND golden_hour_at_risk = 0")
        metrics["golden_hour_success"] = cursor.fetchone()[0]
        
        # Total critical
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE priority IN ('P1', 'P2')")
        metrics["critical_incidents"] = cursor.fetchone()[0]
        
        # Decisions improved by feedback
        cursor.execute("SELECT value FROM metrics WHERE key = 'decisions_improved_by_feedback'")
        row = cursor.fetchone()
        metrics["decisions_improved"] = int(row[0]) if row else 0

        return metrics

def save_pattern(pattern: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO patterns (incident_id, incident_type, context, decision, outcome, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            pattern.get("incident_id"),
            json.dumps(pattern.get("incident_type", {})),
            pattern.get("context"),
            pattern.get("decision"),
            json.dumps(pattern.get("outcome", {})),
            pattern.get("timestamp")
        ))
        conn.commit()

def save_insight(insight: dict):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO insights (patterns_found, rule_suggestions, performance_delta, timestamp)
            VALUES (?, ?, ?, ?)
        ''', (
            json.dumps(insight.get("patterns_found", [])),
            json.dumps(insight.get("rule_suggestions", [])),
            json.dumps(insight.get("performance_delta", {})),
            datetime.now().isoformat()
        ))
        conn.commit()

def get_latest_insight() -> dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT patterns_found, rule_suggestions, performance_delta, timestamp FROM insights ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "patterns_found": json.loads(row[0]) if row[0] else [],
            "rule_suggestions": json.loads(row[1]) if row[1] else [],
            "performance_delta": json.loads(row[2]) if row[2] else {},
            "timestamp": row[3]
        }
def get_patterns(limit: int = 10) -> list:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT incident_id, incident_type, context, decision, outcome, timestamp FROM patterns ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [
            {
                "incident_id": row[0],
                "incident_type": json.loads(row[1]) if row[1] else {},
                "context": row[2],
                "decision": row[3],
                "outcome": json.loads(row[4]) if row[4] else {},
                "timestamp": row[5]
            } for row in rows
        ]

def increment_metric(key: str, amount: int = 1):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM metrics WHERE key = ?", (key,))
        row = cursor.fetchone()
        if row:
            new_val = int(row[0]) + amount
            cursor.execute("UPDATE metrics SET value = ?, updated_at = ? WHERE key = ?", (str(new_val), datetime.now().isoformat(), key))
        else:
            cursor.execute("INSERT INTO metrics (key, value, updated_at) VALUES (?, ?, ?)", (key, str(amount), datetime.now().isoformat()))
        conn.commit()
