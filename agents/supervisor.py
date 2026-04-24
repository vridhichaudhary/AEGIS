from langgraph.graph import StateGraph, END
from typing import Literal
from datetime import datetime
import uuid

from agents.ingestion_agent import IngestionAgent
from agents.parsing_agent import ParsingAgent
from agents.dedup_agent import DeduplicationAgent
from agents.validation_agent import ValidationAgent
from agents.triage_agent import TriageAgent
from agents.dispatch_agent import DispatchAgent
from agents.feedback_agent import FeedbackAgent
from state.schema import AgentState

class SupervisorAgent:
    """LangGraph orchestrator for the 8-agent swarm"""
    
    def __init__(self):
        self.ingestion = IngestionAgent()
        self.parsing = ParsingAgent()
        self.dedup = DeduplicationAgent()
        self.validation = ValidationAgent()
        self.triage = TriageAgent()
        self.dispatch = DispatchAgent()
        self.feedback = FeedbackAgent()
        
        self.graph = self.build_graph()
    
    def build_graph(self) -> StateGraph:
        """Construct the agent execution graph"""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("ingestion", self.ingestion.process)
        workflow.add_node("parsing", self.parsing.process)
        workflow.add_node("deduplication", self.dedup.process)
        workflow.add_node("validation", self.validation.process)
        workflow.add_node("triage", self.triage.process)
        workflow.add_node("dispatch", self.dispatch.process)
        
        # Set entry point
        workflow.set_entry_point("ingestion")
        
        # Define edges
        workflow.add_edge("ingestion", "parsing")
        workflow.add_edge("parsing", "deduplication")
        
        # Conditional: skip if duplicate
        workflow.add_conditional_edges(
            "deduplication",
            self.should_continue_after_dedup,
            {
                "continue": "validation",
                "end": END
            }
        )
        
        # Conditional: callback if low confidence
        workflow.add_conditional_edges(
            "validation",
            self.should_continue_after_validation,
            {
                "continue": "triage",
                "callback": END
            }
        )
        
        workflow.add_edge("triage", "dispatch")
        workflow.add_edge("dispatch", END)
        
        # Compile
        return workflow.compile()
    
    def should_continue_after_dedup(self, state: AgentState) -> Literal["continue", "end"]:
        """Route duplicate calls to merge"""
        if state["is_duplicate"]:
            return "end"
        return "continue"
    
    def should_continue_after_validation(self, state: AgentState) -> Literal["continue", "callback"]:
        """Trigger callback for low-confidence calls"""
        if state["requires_callback"]:
            return "callback"
        return "continue"
    
    async def process_call(self, raw_transcript: str, caller_id: str = None) -> dict:
        """Main entry point: process a single emergency call"""
        
        initial_state = {
            "incident_id": str(uuid.uuid4()),
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
            "dispatch_timestamp": None,
            "agent_trail": [],
            "errors": [],
            "human_override": False,
            "actual_severity": None,
            "response_time_seconds": None,
            "outcome": None,
            "evaluation_score": None
        }
        
        try:
            result = await self.graph.ainvoke(initial_state)
            return result
        except Exception as e:
            initial_state["errors"].append(f"Graph execution failed: {str(e)}")
            return initial_state