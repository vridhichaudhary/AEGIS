import re
from datetime import datetime

from agents.base_agent import BaseAgent
from config.settings import settings

try:
    from langchain_core.messages import HumanMessage
except ImportError:  # pragma: no cover
    HumanMessage = None


class ValidationAgent(BaseAgent):
    """Authenticity and dispatch-readiness checks with conservative safety behavior."""

    CRITICAL_KEYWORDS = [
        "heart attack",
        "cardiac",
        "not breathing",
        "unconscious",
        "behosh",
        "bleeding",
        "khoon",
        "trapped",
        "phas",
        "faase",
        "flood",
        "fire",
        "aag",
        "blast",
        "explosion",
        "riot",
        "danga",
        "knife",
        "chaku",
        "labor pain",
        "water broke",
    ]

    PRANK_KEYWORDS = ["testing", "is this working", "hello", "demo", "check line"]

    def __init__(self):
        super().__init__(temperature=0)
        self.confidence_threshold = settings.VALIDATION_CONFIDENCE_THRESHOLD

    async def llm_confidence_score(self, state: dict) -> float:
        if not self.llm_available or HumanMessage is None:
            return 0.5

        prompt = f"""Score whether this is a real emergency from 0.0 to 1.0.
Call: {state['normalized_text']}
Location: {state['location']['raw_text']}
Incident: {state['incident_type']['category']}
Return only a number."""
        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            match = re.search(r"0?\.\d+|1\.0|0|1", response.content.strip())
            if match:
                return max(0.0, min(1.0, float(match.group())))
        except Exception:
            pass
        return 0.5

    def rule_based_checks(self, state: dict) -> tuple[float, list[str], bool]:
        flags = []
        adjustment = 0.0
        callback_needed = False
        lowered = state["normalized_text"].lower()
        category = state["incident_type"]["category"]
        has_location = bool(state["location"].get("raw_text"))
        has_critical_signal = category in {"fire", "medical", "accident", "natural_disaster", "violence"} and (
            bool(state["severity_clues"]) or any(term in lowered for term in self.CRITICAL_KEYWORDS)
        )

        if any(term in lowered for term in self.PRANK_KEYWORDS) and category == "other":
            flags.append("possible_prank")
            adjustment -= 0.7

        if not has_location:
            flags.append("missing_location")
            adjustment -= 0.15
            callback_needed = True

        if category == "other":
            flags.append("unclear_incident_type")
            adjustment -= 0.2

        if len(lowered) < 15:
            flags.append("very_short_input")
            adjustment -= 0.2

        if state["distress_score"] >= 0.4:
            flags.append("elevated_distress")
            adjustment += 0.15

        if has_critical_signal:
            flags.append("critical_emergency_signal")
            adjustment += 0.35

        if category in {"natural_disaster", "violence"}:
            flags.append("mass_casualty_risk")
            adjustment += 0.15

        if state["victim_count"] >= 3:
            flags.append("multiple_victims")
            adjustment += 0.15

        if has_critical_signal and not has_location:
            flags.append("dispatch_needs_location_confirmation")
            callback_needed = True

        if category == "other" and not has_location and not has_critical_signal:
            callback_needed = True

        return adjustment, flags, callback_needed

    async def process(self, state: dict) -> dict:
        llm_score = await self.llm_confidence_score(state)
        rule_adjustment, flags, callback_needed = self.rule_based_checks(state)
        final_score = max(0.0, min(1.0, llm_score + rule_adjustment))

        if "possible_prank" in flags and "critical_emergency_signal" not in flags:
            final_score = min(final_score, 0.2)

        requires_callback = callback_needed or final_score < self.confidence_threshold
        reasoning = f"LLM/base: {llm_score:.2f}, Rules: {rule_adjustment:+.2f}, Final: {final_score:.2f}"
        if flags:
            reasoning += f" | Flags: {', '.join(flags)}"

        state["agent_trail"].append(
            {
                "agent": "validation",
                "timestamp": datetime.now(),
                "decision": "Proceed with callback safety net" if requires_callback else "Validated for dispatch",
                "reasoning": reasoning,
            }
        )

        return {
            **state,
            "confidence_score": final_score,
            "validation_flags": flags,
            "requires_callback": requires_callback,
        }
