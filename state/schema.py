from typing import TypedDict, List, Optional, Literal
from datetime import datetime

class Location(dict):
    """Location information"""
    pass

class IncidentType(dict):
    """Incident type information"""
    pass

class ResourceRequirement(dict):
    """Resource requirement"""
    pass

class AgentState(TypedDict):
    """Global state shared across all agents"""
    
    # Input
    incident_id: str
    raw_transcript: str
    audio_data: Optional[bytes]
    timestamp: datetime
    caller_id: Optional[str]
    
    # Ingestion
    language_code: str
    normalized_text: str
    
    # Parsing
    location: Optional[dict]
    incident_type: Optional[dict]
    victim_count: int
    severity_clues: List[str]
    distress_score: float
    
    # Deduplication
    is_duplicate: bool
    duplicate_of: Optional[str]
    duplicate_confidence: float
    geo_hash: Optional[str]
    semantic_fingerprint: Optional[List[float]]
    
    # Validation
    confidence_score: float
    validation_flags: List[str]
    requires_callback: bool
    
    # Triage
    priority: str
    priority_score: float
    resource_requirements: List[dict]
    estimated_severity: str
    triage_reasoning: str
    golden_hour_deadline: Optional[datetime]
    golden_hour_at_risk: Optional[bool]
    
    # Dispatch
    assigned_resources: List[dict]
    dispatch_status: str
    incident_status: Literal["PENDING", "DISPATCHED", "ON_SCENE", "RESOLVED"]
    dispatch_timestamp: Optional[datetime]
    joint_dispatch_memo: Optional[dict]
    agency_timings: Optional[dict]
    
    # Metadata
    agent_trail: List[dict]
    errors: List[str]
    human_override: bool
    
    # Feedback
    actual_severity: Optional[str]
    response_time_seconds: Optional[float]
    outcome: Optional[str]
    evaluation_score: Optional[float]