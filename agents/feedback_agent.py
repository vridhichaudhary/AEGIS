from datetime import datetime
from typing import Optional


class FeedbackAgent:
    """Produces safety-oriented feedback signals for continuous improvement."""

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
