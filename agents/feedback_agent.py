from typing import Optional
from datetime import datetime

class FeedbackAgent:
    """Post-incident evaluation and learning"""
    
    def __init__(self):
        pass
    
    async def log_incident_outcome(self, incident_id: str, state: dict, outcome: dict):
        """Record full incident trajectory and outcome"""
        evaluation_data = {
            "incident_id": incident_id,
            "timestamp": state["timestamp"].isoformat(),
            "input": state["raw_transcript"],
            "predicted_priority": state["priority"],
            "actual_severity": outcome.get("actual_severity"),
            "response_time": outcome.get("response_time_seconds"),
            "agent_trail": state["agent_trail"],
            "confidence_score": state["confidence_score"]
        }
        
        # In production, this would log to LangSmith
        print(f"Feedback logged for {incident_id}")
        
        return evaluation_data
    
    def calculate_triage_accuracy(self, predicted: str, actual: Optional[str]) -> Optional[float]:
        """Score triage accuracy"""
        if not actual:
            return None
        
        priority_map = {"P1": 5, "P2": 4, "P3": 3, "P4": 2, "P5": 1}
        
        pred_score = priority_map.get(predicted, 0)
        actual_score = priority_map.get(actual, 0)
        
        diff = abs(pred_score - actual_score)
        
        if diff == 0:
            return 1.0
        elif diff == 1:
            return 0.75
        elif diff == 2:
            return 0.5
        else:
            return 0.0
    
    async def process(self, state: dict, outcome: dict) -> dict:
        """Execute post-incident evaluation"""
        evaluation = await self.log_incident_outcome(
            state["incident_id"],
            state,
            outcome
        )
        
        eval_score = self.calculate_triage_accuracy(
            state["priority"],
            outcome.get("actual_severity")
        ) or 0.5
        
        return {
            **state,
            "evaluation_score": eval_score,
            "outcome": outcome.get("outcome", "Unknown"),
            "actual_severity": outcome.get("actual_severity")
        }