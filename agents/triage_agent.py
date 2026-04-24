import json
from datetime import datetime

from agents.base_agent import BaseAgent

try:
    from langchain_core.messages import HumanMessage
except ImportError:  # pragma: no cover
    HumanMessage = None


class TriageAgent(BaseAgent):
    """High-recall triage for life-critical emergencies."""

    PRIORITY_SCORES = {"P1": 5.0, "P2": 4.0, "P3": 3.0, "P4": 2.0, "P5": 1.0}

    def __init__(self):
        super().__init__(temperature=0)

    def heuristic_triage(self, state: dict) -> dict:
        text = state["normalized_text"].lower()
        category = state["incident_type"]["category"]
        subcategory = state["incident_type"].get("subcategory", "")
        clues = set(state.get("severity_clues", []))
        victims = state.get("victim_count", 1)

        if "possible_prank" in state.get("validation_flags", []) and category == "other":
            return {
                "priority_level": "P5",
                "priority_justification": "Non-emergency or probable prank indicators detected.",
                "required_resources": [],
                "estimated_severity": "minor",
            }

        if category == "fire" and (
            "trapped" in " ".join(clues)
            or "upper_floor_entrapment" in clues
            or "blast" in text
            or "explosion" in text
        ):
            return {
                "priority_level": "P1",
                "priority_justification": "Fire or blast with entrapment requires immediate multi-unit response.",
                "required_resources": [
                    {"type": "fire_truck_rescue", "quantity": 1, "specialized": True},
                    {"type": "ambulance_trauma", "quantity": 1, "specialized": True},
                ],
                "estimated_severity": "critical",
            }

        if category == "medical" and any(
            token in text for token in ["heart attack", "cardiac", "not breathing", "unconscious", "behosh"]
        ):
            return {
                "priority_level": "P1",
                "priority_justification": "Potential cardiac or airway compromise requires immediate intervention.",
                "required_resources": [{"type": "ambulance_cardiac", "quantity": 1, "specialized": True}],
                "estimated_severity": "critical",
            }

        if category == "medical" and subcategory == "obstetric_emergency":
            return {
                "priority_level": "P1",
                "priority_justification": "Active labor complication may become life-threatening rapidly.",
                "required_resources": [{"type": "ambulance", "quantity": 1, "specialized": False}],
                "estimated_severity": "critical",
            }

        if category == "accident" and (
            victims >= 2
            or any(token in text for token in ["bleeding", "khoon", "unconscious", "behosh", "multiple vehicles"])
        ):
            return {
                "priority_level": "P1",
                "priority_justification": "Major road traffic collision with serious injuries.",
                "required_resources": [
                    {"type": "ambulance_trauma", "quantity": 1, "specialized": True},
                    {"type": "police", "quantity": 1, "specialized": False},
                ],
                "estimated_severity": "critical",
            }

        if category == "natural_disaster":
            priority = "P1" if victims >= 2 or any(token in text for token in ["trapped", "children", "bachche", "roof", "chhat"]) else "P2"
            return {
                "priority_level": priority,
                "priority_justification": "Disaster scenario with potential multi-casualty exposure.",
                "required_resources": [
                    {"type": "rescue_team", "quantity": 1, "specialized": True},
                    {"type": "ambulance", "quantity": 1, "specialized": False},
                ],
                "estimated_severity": "critical" if priority == "P1" else "serious",
            }

        if category == "violence":
            priority = "P1" if any(token in text for token in ["knife", "chaku", "gun", "riot", "danga"]) else "P2"
            resources = [{"type": "police", "quantity": 1, "specialized": False}]
            if priority == "P1":
                resources.append({"type": "ambulance_trauma", "quantity": 1, "specialized": True})
            return {
                "priority_level": priority,
                "priority_justification": "Active violence with weapon risk requires urgent police-led response.",
                "required_resources": resources,
                "estimated_severity": "critical" if priority == "P1" else "serious",
            }

        if category == "fire":
            return {
                "priority_level": "P2",
                "priority_justification": "Fire emergency requires urgent response even without confirmed entrapment.",
                "required_resources": [{"type": "fire_truck", "quantity": 1, "specialized": False}],
                "estimated_severity": "serious",
            }

        if category == "medical":
            return {
                "priority_level": "P2",
                "priority_justification": "Medical emergency needs rapid ambulance evaluation.",
                "required_resources": [{"type": "ambulance", "quantity": 1, "specialized": False}],
                "estimated_severity": "serious",
            }

        return {
            "priority_level": "P4",
            "priority_justification": "Insufficient evidence of an active emergency after validation.",
            "required_resources": [],
            "estimated_severity": "minor",
        }

    async def process(self, state: dict) -> dict:
        triage_data = None

        if self.llm_available and HumanMessage is not None:
            prompt = f"""Assign emergency priority P1-P5 and resources.
Call: {state['normalized_text']}
Type: {state['incident_type']['category']}
Victims: {state['victim_count']}
Confidence: {state['confidence_score']}
Return only JSON with priority_level, priority_justification, required_resources, estimated_severity."""
            try:
                response = await self.invoke_llm([HumanMessage(content=prompt)])
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
