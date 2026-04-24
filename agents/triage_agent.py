import json
from datetime import datetime

from agents.base_agent import BaseAgent

try:
    from langchain_core.messages import HumanMessage
except ImportError:  # pragma: no cover - optional dependency
    HumanMessage = None


class TriageAgent(BaseAgent):
    """Assigns priority with an LLM when possible and deterministic rules otherwise."""

    PRIORITY_SCORES = {"P1": 5.0, "P2": 4.0, "P3": 3.0, "P4": 2.0, "P5": 1.0}

    def __init__(self):
        super().__init__(temperature=0)

    def heuristic_triage(self, state: dict) -> dict:
        text = state["normalized_text"].lower()
        incident_type = state["incident_type"]["category"]
        clues = set(state.get("severity_clues", []))
        victim_count = state.get("victim_count", 1)

        if any(term in text for term in ["testing", "is this working", "hello?"]) and incident_type == "other":
            return {
                "priority_level": "P5",
                "priority_justification": "Likely non-emergency or prank call.",
                "required_resources": [],
                "estimated_severity": "minor",
            }

        if incident_type == "fire" and any(term in text for term in ["trapped", "faase", "fas", "third floor"]):
            return {
                "priority_level": "P1",
                "priority_justification": "Fire with likely entrapment requires immediate response.",
                "required_resources": [
                    {"type": "fire_truck_rescue", "quantity": 1, "specialized": True},
                    {"type": "ambulance", "quantity": 1, "specialized": False},
                ],
                "estimated_severity": "critical",
            }

        if incident_type == "medical" and any(
            term in text for term in ["heart attack", "unconscious", "not breathing", "cardiac", "behosh"]
        ):
            return {
                "priority_level": "P1",
                "priority_justification": "Critical medical symptoms demand immediate dispatch.",
                "required_resources": [{"type": "ambulance_cardiac", "quantity": 1, "specialized": True}],
                "estimated_severity": "critical",
            }

        if incident_type == "accident" and (
            "bleeding" in text or "khoon" in text or victim_count >= 2 or "unconscious" in clues
        ):
            return {
                "priority_level": "P2",
                "priority_justification": "Accident with injuries requires urgent intervention.",
                "required_resources": [{"type": "ambulance_trauma", "quantity": 1, "specialized": True}],
                "estimated_severity": "serious",
            }

        if incident_type == "violence":
            return {
                "priority_level": "P2",
                "priority_justification": "Potential violence requires police response.",
                "required_resources": [{"type": "police", "quantity": 1, "specialized": False}],
                "estimated_severity": "serious",
            }

        resource_type = "fire_truck" if incident_type == "fire" else "ambulance" if incident_type == "medical" else None
        resources = [{"type": resource_type, "quantity": 1, "specialized": False}] if resource_type else []
        return {
            "priority_level": "P3" if resources else "P4",
            "priority_justification": "Moderate severity based on available transcript details.",
            "required_resources": resources,
            "estimated_severity": "moderate" if resources else "minor",
        }

    async def process(self, state: dict) -> dict:
        triage_data = None

        if self.llm_available and HumanMessage is not None:
            prompt = f"""You are the Chief Triage Officer for India's National Emergency Response.

TASK: Assign priority P1-P5 and determine required resources.

INCIDENT DATA:
Call: "{state['normalized_text']}"
Location: {state['location']['raw_text']}
Type: {state['incident_type']['category']}
Victims: {state['victim_count']}
Distress: {state['distress_score']:.2f}
Confidence: {state['confidence_score']:.2f}

Return ONLY valid JSON:
{{
  "priority_level": "P1|P2|P3|P4|P5",
  "priority_justification": "brief explanation",
  "required_resources": [
    {{"type": "ambulance", "quantity": 1, "specialized": false}}
  ],
  "estimated_severity": "critical|serious|moderate|minor"
}}

JSON OUTPUT:"""

            try:
                response = await self.llm.ainvoke([HumanMessage(content=prompt)])
                content = response.content.strip()
                if content.startswith("```json"):
                    content = content.replace("```json", "").replace("```", "").strip()
                triage_data = json.loads(content)
            except Exception as exc:
                state["errors"].append(f"Triage LLM fallback triggered: {exc}")

        if triage_data is None:
            triage_data = self.heuristic_triage(state)

        priority_score = self.PRIORITY_SCORES.get(triage_data["priority_level"], 3.0)
        priority_score += state["distress_score"] * 0.5

        state["agent_trail"].append(
            {
                "agent": "triage",
                "timestamp": datetime.now(),
                "decision": f"Assigned {triage_data['priority_level']}",
                "reasoning": triage_data["priority_justification"],
            }
        )

        return {
            **state,
            "priority": triage_data["priority_level"],
            "priority_score": priority_score,
            "resource_requirements": triage_data["required_resources"],
            "estimated_severity": triage_data["estimated_severity"],
            "triage_reasoning": triage_data["priority_justification"],
        }
