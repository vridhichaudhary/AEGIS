import json
from datetime import datetime, timedelta
from typing import List

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class ResourceRequirement(BaseModel):
    type: str = Field(description="Type of resource, e.g. ambulance, police, fire_truck")
    quantity: int = Field(description="Number of resources needed")
    specialized: bool = Field(description="Whether the resource needs to be specialized (e.g. trauma ambulance)")

class TriageResult(BaseModel):
    priority_level: str = Field(description="Priority level: P1 (critical), P2, P3, P4, P5 (minor)")
    priority_justification: str = Field(description="Reasoning for the assigned priority")
    required_resources: List[ResourceRequirement] = Field(description="List of resources required to handle the emergency")
    estimated_severity: str = Field(description="One of: critical, serious, moderate, minor")
    golden_hour_at_risk: bool = Field(description="True if it is likely that definitive care cannot be reached within 60 minutes", default=False)

class TriageAgent(BaseAgent):
    """High-recall triage for life-critical emergencies."""

    PRIORITY_SCORES = {"P1": 5.0, "P2": 4.0, "P3": 3.0, "P4": 2.0, "P5": 1.0}

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=TriageResult)

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
                "golden_hour_at_risk": False,
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
                "golden_hour_at_risk": True,
            }

        if category == "medical" and any(
            token in text for token in ["heart attack", "cardiac", "not breathing", "unconscious", "behosh"]
        ):
            return {
                "priority_level": "P1",
                "priority_justification": "Potential cardiac or airway compromise requires immediate intervention.",
                "required_resources": [{"type": "ambulance_cardiac", "quantity": 1, "specialized": True}],
                "estimated_severity": "critical",
                "golden_hour_at_risk": True,
            }

        if category == "medical" and subcategory == "obstetric_emergency":
            return {
                "priority_level": "P1",
                "priority_justification": "Active labor complication may become life-threatening rapidly.",
                "required_resources": [{"type": "ambulance", "quantity": 1, "specialized": False}],
                "estimated_severity": "critical",
                "golden_hour_at_risk": False,
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
                "golden_hour_at_risk": True,
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
                "golden_hour_at_risk": True if priority == "P1" else False,
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
                "golden_hour_at_risk": True if priority == "P1" else False,
            }

        if category == "fire":
            return {
                "priority_level": "P2",
                "priority_justification": "Fire emergency requires urgent response even without confirmed entrapment.",
                "required_resources": [{"type": "fire_truck", "quantity": 1, "specialized": False}],
                "estimated_severity": "serious",
                "golden_hour_at_risk": False,
            }

        if category == "medical":
            return {
                "priority_level": "P2",
                "priority_justification": "Medical emergency needs rapid ambulance evaluation.",
                "required_resources": [{"type": "ambulance", "quantity": 1, "specialized": False}],
                "estimated_severity": "serious",
                "golden_hour_at_risk": False,
            }

        # Indian emergency type heuristics fallback
        if any(token in text for token in ["chemical spill", "chemical", "gas leak"]):
            return {"priority_level": "P1", "priority_justification": "Chemical/gas leak requires hazmat and fire response.", "required_resources": [{"type": "fire_truck_rescue", "quantity": 1, "specialized": True}, {"type": "ambulance", "quantity": 1, "specialized": False}], "estimated_severity": "critical", "golden_hour_at_risk": True}
        if any(token in text for token in ["building collapse", "gir gaya", "collapse"]):
            return {"priority_level": "P1", "priority_justification": "Building collapse requires heavy rescue.", "required_resources": [{"type": "rescue_team", "quantity": 1, "specialized": True}, {"type": "ambulance_trauma", "quantity": 1, "specialized": True}], "estimated_severity": "critical", "golden_hour_at_risk": True}
        if any(token in text for token in ["stampede", "bheed"]):
            return {"priority_level": "P1", "priority_justification": "Stampede involves multiple trauma victims.", "required_resources": [{"type": "police", "quantity": 1, "specialized": False}, {"type": "ambulance_trauma", "quantity": 2, "specialized": True}], "estimated_severity": "critical", "golden_hour_at_risk": True}
        if any(token in text for token in ["cylinder blast", "blast", "explosion"]):
            return {"priority_level": "P1", "priority_justification": "Gas cylinder blast requires fire and medical.", "required_resources": [{"type": "fire_truck", "quantity": 1, "specialized": False}, {"type": "ambulance_trauma", "quantity": 1, "specialized": True}], "estimated_severity": "critical", "golden_hour_at_risk": True}
        if any(token in text for token in ["drowning", "doob"]):
            return {"priority_level": "P1", "priority_justification": "Drowning requires immediate resuscitation.", "required_resources": [{"type": "ambulance_cardiac", "quantity": 1, "specialized": True}], "estimated_severity": "critical", "golden_hour_at_risk": True}
        if any(token in text for token in ["electrocution", "current", "bijli"]):
            return {"priority_level": "P1", "priority_justification": "Electrocution requires immediate cardiac evaluation.", "required_resources": [{"type": "ambulance_cardiac", "quantity": 1, "specialized": True}], "estimated_severity": "critical", "golden_hour_at_risk": True}
        if any(token in text for token in ["snakebite", "saamp", "snake"]):
            return {"priority_level": "P2", "priority_justification": "Snakebite requires anti-venom at hospital.", "required_resources": [{"type": "ambulance", "quantity": 1, "specialized": False}], "estimated_severity": "serious", "golden_hour_at_risk": False}
        if any(token in text for token in ["heat stroke", "loo", "heatstroke"]):
            return {"priority_level": "P2", "priority_justification": "Heat stroke requires immediate cooling and fluids.", "required_resources": [{"type": "ambulance", "quantity": 1, "specialized": False}], "estimated_severity": "serious", "golden_hour_at_risk": False}

        if category == "accident":
            # Minor accident — still needs medical + traffic management
            return {
                "priority_level": "P3",
                "priority_justification": "Minor road accident requires medical assessment and traffic management.",
                "required_resources": [
                    {"type": "ambulance", "quantity": 1, "specialized": False},
                    {"type": "police", "quantity": 1, "specialized": False},
                ],
                "estimated_severity": "moderate",
                "golden_hour_at_risk": False,
            }

        return {
            "priority_level": "P4",
            "priority_justification": "Insufficient evidence of an active emergency after validation.",
            "required_resources": [],
            "estimated_severity": "minor",
            "golden_hour_at_risk": False,
        }

    async def process(self, state: dict) -> dict:
        triage_data = None
        triage_method = "llm_standard"
        category = state["incident_type"]["category"]
        unknown_emergency = (category == "other" or category is None)

        if self.llm_available and HumanMessage is not None:
            format_instructions = self.parser.get_format_instructions()
            
            if unknown_emergency:
                triage_method = "llm_novel_scenario"
                prompt = f"""You are a senior emergency triage officer. A 112 call came in with unrecognized emergency type.
Transcript: {state['normalized_text']}
Distress indicators found: {state.get('severity_clues', [])}
CRITICAL RULE: When in doubt, OVER-TRIAGE rather than under-triage. A falsely dispatched ambulance costs money; an untreated emergency costs a life.
Assess: 1) What is the most likely emergency type? 2) What is the appropriate priority P1-P5?
3) What resources are most likely needed? 4) What is your confidence level?
Return JSON with: category, priority_level, required_resources, confidence, priority_justification (map the reasoning here), estimated_severity (critical, serious, moderate, minor), golden_hour_at_risk (boolean)
{format_instructions}"""
            else:
                prompt = f"""You are an expert emergency dispatch triage officer.
Your task is to assign an emergency priority (P1-P5) and allocate resources based on standard operating procedures.

Evaluate if this incident can receive definitive care within the 60-minute golden hour. If not, escalate priority and flag golden_hour_at_risk=true.

Guidelines:
- P1 (Critical): Life-threatening. E.g., Fire with entrapment, cardiac arrest, major trauma, active shooter.
- P2 (Serious): Urgent but stable. E.g., Fire without entrapment, severe pain, non-critical injuries.
- P3 (Moderate): Routine emergency. E.g., Minor accidents, small fires.
- P4 (Minor): Non-urgent. E.g., Public nuisance, minor illness.
- P5 (Non-Emergency): Pranks, informational calls.

Call: {state['normalized_text']}
Type: {state['incident_type']['category']}
Victims: {state['victim_count']}
Confidence: {state['confidence_score']}

{format_instructions}"""
            try:
                response = await self.invoke_llm([HumanMessage(content=prompt)])
                triage_data = self.parser.parse(response.content)
            except Exception as exc:
                state["errors"].append(f"Triage LLM fallback triggered: {exc}")

        if triage_data is None:
            if unknown_emergency:
                triage_method = "safe_default"
                triage_data = {
                    "priority_level": "P2",
                    "priority_justification": "Unknown emergency type. Defaulting to safe over-triage.",
                    "required_resources": [
                        {"type": "ambulance", "quantity": 1, "specialized": False},
                        {"type": "police", "quantity": 1, "specialized": False}
                    ],
                    "estimated_severity": "serious",
                    "golden_hour_at_risk": False
                }
            else:
                triage_method = "heuristic"
                triage_data = self.heuristic_triage(state)

        priority = triage_data.get("priority_level", "P4")
        priority_score = self.PRIORITY_SCORES.get(priority, 3.0)
        priority_score += state["distress_score"] * 0.5

        is_critical = priority in ["P1", "P2"]
        golden_hour_deadline = state["timestamp"] + timedelta(minutes=60) if is_critical else None
        golden_hour_at_risk = triage_data.get("golden_hour_at_risk", is_critical) if is_critical else False

        state["triage_method"] = triage_method
        state["agent_trail"].append(
            {
                "agent": "triage",
                "timestamp": datetime.now(),
                "decision": f"Assigned {priority}{' - ⚠ GOLDEN HOUR AT RISK' if golden_hour_at_risk else ''}",
                "reasoning": triage_data.get("priority_justification", ""),
                "triage_method": triage_method
            }
        )

        return {
            **state,
            "priority": priority,
            "priority_score": priority_score,
            "resource_requirements": triage_data.get("required_resources", []),
            "estimated_severity": triage_data.get("estimated_severity", "minor"),
            "triage_reasoning": triage_data.get("priority_justification", ""),
            "golden_hour_deadline": golden_hour_deadline,
            "golden_hour_at_risk": golden_hour_at_risk,
            "triage_method": triage_method,
        }
