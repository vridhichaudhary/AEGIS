import re
from datetime import datetime

from agents.base_agent import BaseAgent
from config.settings import settings

try:
    from langchain_core.messages import HumanMessage
except ImportError:  # pragma: no cover - optional dependency
    HumanMessage = None


class ValidationAgent(BaseAgent):
    """Confidence scoring with optional LLM support and reliable heuristics."""

    def __init__(self):
        super().__init__(temperature=0)
        self.confidence_threshold = settings.VALIDATION_CONFIDENCE_THRESHOLD

    async def llm_confidence_score(self, state: dict) -> float:
        if not self.llm_available or HumanMessage is None:
            return 0.5

        prompt = f"""You are validating emergency calls for India's 911 system.

TASK: Score if this is a REAL emergency (0.0 = fake/prank, 1.0 = genuine emergency)

CALL TEXT: "{state['normalized_text']}"

EXTRACTED INFO:
- Location: {state['location']['raw_text']}
- Type: {state['incident_type']['category']}
- Distress level: {state['distress_score']:.2f}

Return ONLY a single number between 0.0 and 1.0.

CONFIDENCE SCORE:"""

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            score_text = response.content.strip()
            match = re.search(r"0?\.\d+|1\.0|0|1", score_text)
            if match:
                return max(0.0, min(1.0, float(match.group())))
        except Exception:
            pass
        return 0.5

    def rule_based_checks(self, state: dict) -> tuple[float, list[str]]:
        flags = []
        adjustment = 0.0
        lowered = state["normalized_text"].lower()

        if not state["location"].get("raw_text"):
            flags.append("missing_location")
            adjustment -= 0.3

        if state["incident_type"]["category"] == "other":
            flags.append("unclear_incident_type")
            adjustment -= 0.2

        if state["distress_score"] > 0.5:
            flags.append("high_distress_detected")
            adjustment += 0.2

        if len(lowered) < 20:
            flags.append("extremely_short_input")
            adjustment -= 0.3

        if any(term in lowered for term in ["testing", "hello?", "is this working", "test call"]):
            flags.append("possible_prank")
            adjustment -= 0.5

        if any(
            kw in lowered
            for kw in ["unconscious", "bleeding", "heart attack", "behosh", "khoon", "cardiac", "accident", "aag"]
        ):
            flags.append("critical_keywords")
            adjustment += 0.15

        return adjustment, flags

    async def process(self, state: dict) -> dict:
        llm_score = await self.llm_confidence_score(state)
        rule_adjustment, flags = self.rule_based_checks(state)
        final_score = max(0.0, min(1.0, llm_score + rule_adjustment))
        requires_callback = final_score < self.confidence_threshold

        reasoning = f"LLM/base: {llm_score:.2f}, Rules: {rule_adjustment:+.2f}, Final: {final_score:.2f}"
        if flags:
            reasoning += f" | Flags: {', '.join(flags)}"

        state["agent_trail"].append(
            {
                "agent": "validation",
                "timestamp": datetime.now(),
                "decision": "Callback required" if requires_callback else "Proceeding",
                "reasoning": reasoning,
            }
        )

        return {
            **state,
            "confidence_score": final_score,
            "validation_flags": flags,
            "requires_callback": requires_callback,
        }
