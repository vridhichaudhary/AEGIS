from langchain_core.messages import HumanMessage
from agents.base_agent import BaseAgent
from datetime import datetime
import re

class ValidationAgent(BaseAgent):
    """Confidence scoring using FREE Gemini"""
    
    def __init__(self):
        super().__init__(temperature=0)
        from config.settings import settings
        self.confidence_threshold = settings.VALIDATION_CONFIDENCE_THRESHOLD
    
    async def llm_confidence_score(self, state: dict) -> float:
        """Use FREE Gemini to score authenticity 0-1"""
        
        prompt = f"""You are validating emergency calls for India's 911 system.

TASK: Score if this is a REAL emergency (0.0 = fake/prank, 1.0 = genuine emergency)

CALL TEXT: "{state['normalized_text']}"

EXTRACTED INFO:
- Location: {state['location']['raw_text']}
- Type: {state['incident_type']['category']}
- Distress level: {state['distress_score']:.2f}

GENUINE EMERGENCY SIGNS:
✓ Specific location/landmark
✓ Clear incident description
✓ Urgency/panic in language
✓ Actionable details

FAKE/PRANK SIGNS:
✗ Vague or no location
✗ Testing phrases ("hello?", "is this working?")
✗ No clear emergency
✗ Contradictory information

Return ONLY a single number between 0.0 and 1.0 (e.g., 0.85)

CONFIDENCE SCORE:"""

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            score_text = response.content.strip()
            
            # Extract number
            match = re.search(r'0?\.\d+|1\.0|0|1', score_text)
            if match:
                score = float(match.group())
                return max(0.0, min(1.0, score))
            return 0.5
        except:
            return 0.5
    
    def rule_based_checks(self, state: dict) -> tuple:
        """Heuristic rules to boost/reduce confidence"""
        flags = []
        adjustment = 0.0
        
        if not state["location"].get("raw_text"):
            flags.append("missing_location")
            adjustment -= 0.3
        
        if state["incident_type"]["category"] == "other":
            flags.append("unclear_incident_type")
            adjustment -= 0.2
        
        if state["distress_score"] > 0.7:
            flags.append("high_distress_detected")
            adjustment += 0.2
        
        text = state["normalized_text"]
        if len(text) < 20:
            flags.append("extremely_short_input")
            adjustment -= 0.3
        
        medical_keywords = ['unconscious', 'bleeding', 'heart attack', 'behosh', 'khoon', 'cardiac', 'accident', 'aag']
        if any(kw in text.lower() for kw in medical_keywords):
            flags.append("critical_keywords")
            adjustment += 0.15
        
        return adjustment, flags
    
    async def process(self, state: dict) -> dict:
        """Combine FREE Gemini + rule-based confidence scoring"""
        
        # Gemini scoring
        llm_score = await self.llm_confidence_score(state)
        
        # Rule-based adjustments
        rule_adjustment, flags = self.rule_based_checks(state)
        
        # Final confidence
        final_score = max(0.0, min(1.0, llm_score + rule_adjustment))
        
        # Callback decision
        requires_callback = final_score < self.confidence_threshold
        
        # Log reasoning
        reasoning = f"Gemini: {llm_score:.2f}, Rules: {rule_adjustment:+.2f}, Final: {final_score:.2f}"
        if flags:
            reasoning += f" | Flags: {', '.join(flags)}"
        
        state["agent_trail"].append({
            "agent": "validation",
            "timestamp": datetime.now(),
            "decision": "Callback required" if requires_callback else "Proceeding",
            "reasoning": reasoning
        })
        
        return {
            **state,
            "confidence_score": final_score,
            "validation_flags": flags,
            "requires_callback": requires_callback
        }