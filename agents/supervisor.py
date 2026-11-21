from __future__ import annotations

import uuid
from datetime import datetime
from agents.dedup_agent import DeduplicationAgent
from agents.dispatch_agent import DispatchAgent
from agents.feedback_agent import FeedbackAgent
from agents.ingestion_agent import IngestionAgent
from agents.parsing_agent import ParsingAgent
from agents.triage_agent import TriageAgent
from agents.validation_agent import ValidationAgent
from state.schema import AgentState

try:
    from langgraph.graph import END, StateGraph
except ImportError:  # pragma: no cover
    END = "__end__"
    StateGraph = None


class SupervisorAgent:
    """Supervises the full emergency flow with safety-first continuation."""

    def __init__(self):
        self.ingestion = IngestionAgent()
        self.parsing = ParsingAgent()
        self.dedup = DeduplicationAgent()
        self.validation = ValidationAgent()
        self.triage = TriageAgent()
        self.dispatch = DispatchAgent()
        self.feedback = FeedbackAgent()
        self.graph = self.build_graph() if StateGraph is not None else None

    def build_graph(self):
        workflow = StateGraph(AgentState)
        workflow.add_node("ingestion", self.ingestion.process)
        workflow.add_node("parsing", self.parsing.process)
        workflow.add_node("deduplication", self.dedup.process)
        workflow.add_node("validation", self.validation.process)
        workflow.add_node("triage", self.triage.process)
        workflow.add_node("dispatch", self.dispatch.process)
        workflow.add_node("feedback", self.feedback.process)
        workflow.set_entry_point("ingestion")
        workflow.add_edge("ingestion", "parsing")
        workflow.add_edge("parsing", "deduplication")
        workflow.add_edge("deduplication", "validation")
        workflow.add_edge("validation", "triage")
        workflow.add_edge("triage", "dispatch")
        workflow.add_edge("dispatch", "feedback")
        workflow.add_edge("feedback", END)
        return workflow.compile()

    async def process_call(self, raw_transcript: str, caller_id: str = None, *, incident_id: str = None,
                           channel: str = "voice_call", gps_override: dict = None,
                           operator_category: str = None) -> dict:
        initial_state = {
            "incident_id": incident_id or str(uuid.uuid4()),
            "channel": channel,
            "gps_override": gps_override,
            "operator_category": operator_category,
            "raw_transcript": raw_transcript,
            "audio_data": None,
            "timestamp": datetime.now(),
            "caller_id": caller_id,
            "language_code": "",
            "normalized_text": "",
            "location": None,
            "incident_type": None,
            "victim_count": 1,
            "severity_clues": [],
            "distress_score": 0.0,
            "is_duplicate": False,
            "duplicate_of": None,
            "duplicate_confidence": 0.0,
            "geo_hash": None,
            "semantic_fingerprint": None,
            "confidence_score": 0.0,
            "validation_flags": [],
            "requires_callback": False,
            "priority": "P3",
            "priority_score": 3.0,
            "resource_requirements": [],
            "estimated_severity": "",
            "triage_reasoning": "",
            "assigned_resources": [],
            "dispatch_status": "pending",
            "incident_status": "PENDING",
            "dispatch_timestamp": None,
            "agent_trail": [],
            "errors": [],
            "human_override": bool(operator_category),
            "actual_severity": None,
            "response_time_seconds": None,
            "outcome": None,
            "evaluation_score": None,
        }

        try:
            if self.graph is not None:
                result = await self.graph.ainvoke(initial_state)
            else:
                result = await self.run_sequential(initial_state)
            if result["dispatch_status"] in {"review_required", "not_required", "awaiting_location"}:
                self.dedup.forget(initial_state["incident_id"])
            return result
        except Exception as exc:
            await self.dispatch.release_resources(initial_state["incident_id"])
            self.dedup.forget(initial_state["incident_id"])
            initial_state["errors"].append(f"Graph execution failed: {exc}")
            return initial_state

    async def run(self, raw_transcript: str, pre_state: dict = None) -> dict:
        """Entry point that supports pre-state overrides (e.g., from WhatsApp webhook)."""
        inputs = pre_state or {}
        return await self.process_call(
            raw_transcript, caller_id=inputs.get("caller_id"),
            channel=inputs.get("channel", "voice_call"), gps_override=inputs.get("gps_override"),
        )

    async def run_sequential(self, state: dict) -> dict:
        state = await self.ingestion.process(state)
        state = await self.parsing.process(state)
        state = await self.dedup.process(state)
        state = await self.validation.process(state)
        state = await self.triage.process(state)
        state = await self.dispatch.process(state)
        state = await self.feedback.process(state)
        return state
