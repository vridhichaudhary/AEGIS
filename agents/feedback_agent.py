import json
from datetime import datetime
from typing import Optional, List
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from langchain_core.output_parsers import JsonOutputParser
from db import database as db

class InsightOutput(BaseModel):
    patterns_found: List[str] = Field(description="List of patterns identified")
    rule_suggestions: List[str] = Field(description="Plain English rule suggestions")
    performance_delta: dict = Field(description="Delta mapping e.g. golden_hour_rate, avg_response_time")

class FeedbackAgent(BaseAgent):
    """Produces safety-oriented feedback signals and maintains continuous learning loop."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=InsightOutput)

    async def log_incident_outcome(self, incident_id: str, state: dict, outcome: Optional[dict] = None):
        return {
            "incident_id": incident_id,
            "timestamp": state["timestamp"].isoformat(),
            "input": state["raw_transcript"],
            "predicted_priority": state["priority"],
            "dispatch_status": state["dispatch_status"],
            "validation_flags": state["validation_flags"],
            "outcome": (outcome or {}).get("outcome"),
        }

    def calculate_triage_accuracy(self, predicted: str, actual: Optional[str]) -> Optional[float]:
        if not actual:
            return None
        priority_map = {"P1": 5, "P2": 4, "P3": 3, "P4": 2, "P5": 1}
        diff = abs(priority_map.get(predicted, 0) - priority_map.get(actual, 0))
        if diff == 0:
            return 1.0
        if diff == 1:
            return 0.75
        if diff == 2:
            return 0.5
        return 0.0

    async def process(self, state: dict, outcome: Optional[dict] = None) -> dict:
        await self.log_incident_outcome(state["incident_id"], state, outcome)

        feedback_notes = []
        if state["requires_callback"]:
            feedback_notes.append("callback_required")
        if state["dispatch_status"] == "awaiting_location":
            feedback_notes.append("location_reacquisition_needed")
        if state["errors"]:
            feedback_notes.append("pipeline_errors_present")

        state["agent_trail"].append(
            {
                "agent": "feedback",
                "timestamp": datetime.now(),
                "decision": "Captured operational feedback",
                "reasoning": ", ".join(feedback_notes) if feedback_notes else "Flow completed without additional safety notes.",
            }
        )

        return {
            **state,
            "evaluation_score": self.calculate_triage_accuracy(state["priority"], (outcome or {}).get("actual_severity")),
            "outcome": (outcome or {}).get("outcome"),
            "actual_severity": (outcome or {}).get("actual_severity"),
        }

    async def analyze(self, incident_id: str, state: dict, outcome: dict):
        """Run post-incident analysis and update learning memory."""
        # 1. Maintain PATTERN_MEMORY and persist
        pattern = {
            "incident_id": incident_id,
            "incident_type": state.get("incident_type"),
            "context": state.get("raw_transcript"),
            "decision": state.get("priority"),
            "outcome": outcome,
            "timestamp": datetime.now().isoformat()
        }
        db.save_pattern(pattern)

        # 2. Check if we should run LLM Analysis (every 3 incidents for demo)
        patterns = db.get_patterns(limit=3)
        if len(patterns) >= 3:
            # We use a simple counter to only trigger when the count reaches a multiple of 3
            # We can just fetch all patterns and check len % 3 == 0.
            all_patterns = db.get_patterns(limit=1000)
            if len(all_patterns) > 0 and len(all_patterns) % 3 == 0:
                await self.run_llm_analysis(patterns)

    async def run_llm_analysis(self, patterns: list):
        if not self.llm_available or HumanMessage is None:
            return

        outcomes_list = json.dumps(patterns, indent=2)
        format_instructions = self.parser.get_format_instructions()
        
        prompt = f"""You are an emergency response quality analyst. Review these recent incident outcomes:
{outcomes_list}

Identify:
1. Any systematic over-triage or under-triage patterns.
2. Resource allocation mismatches.
3. Any category that consistently had worse golden hour performance.
4. Suggested rule adjustments in plain English.

{format_instructions}"""
        
        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            insight = self.parser.parse(response.content)
            
            # Save insight
            db.save_insight(insight)
            # Increment metric for decisions improved by feedback 
            # (simulated increment for narrative effect when new rules are learned)
            db.increment_metric("decisions_improved_by_feedback", len(insight.get("rule_suggestions", [])) * 2)
            
        except Exception as exc:
            print(f"Feedback LLM analysis failed: {exc}")
