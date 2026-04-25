import json
import asyncio
from datetime import datetime
from typing import List, Literal, Tuple

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class ValidationResult(BaseModel):
    authenticity_score: int = Field(description="Authenticity score from 0 to 100")
    reasoning: List[str] = Field(description="3-5 bullet points explaining your conclusion")
    recommended_action: Literal["DISPATCH", "HOLD", "INVESTIGATE", "REVIEW"] = Field(description="Recommended action based on score")
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(description="Confidence in your assessment")

class ValidationAgent(BaseAgent):
    """Deep agentic prank/hoax detection with robust rule-based fallback."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ValidationResult)

    def rule_based_authenticity(self, transcript: str, location: str, victim_count: int) -> Tuple[int, List[str]]:
        """Fallback rule-based scoring system when LLM is unavailable."""
        score = 70  # neutral start
        reasons = []
        lowered = transcript.lower()

        # Positive signals (increase authenticity)
        distress_terms = ['please', 'help', 'jaldi', 'bachao', 'save', 'emergency', 'help me', 'madad']
        if any(term in lowered for term in distress_terms):
            score += 8
            reasons.append("Genuine distress language detected")
        
        if location and location != "Unknown" and len(location) > 3:
            score += 7
            reasons.append("Specific location provided")
        
        if victim_count is not None and 1 <= victim_count <= 20:
            score += 5
            reasons.append("Plausible victim count")
            
        if len(transcript.split()) > 15:
            score += 5
            reasons.append("Detailed description provided")

        # Negative signals (decrease authenticity)
        if victim_count is not None and victim_count > 100:
            score -= 25
            reasons.append("Implausible victim count")
            
        if len(transcript.split()) < 5:
            score -= 20
            reasons.append("Suspiciously brief call")
            
        if transcript.count('!') > 5:
            score -= 10
            reasons.append("Excessive punctuation pattern")
            
        hoax_terms = ['haha', 'lol', 'fake', 'prank', 'testing', 'mazak', 'masti']
        if any(word in lowered for word in hoax_terms):
            score -= 40
            reasons.append("Hoax language detected")
            
        if (not location or location == "Unknown") and (victim_count is None or victim_count == 0):
            score -= 15
            reasons.append("No verifiable details (Unknown location/victims)")

        return max(0, min(100, score)), reasons

    async def process(self, state: dict) -> dict:
        validation_data = None
        validation_method = "llm"
        
        transcript = state.get('raw_transcript', state.get('normalized_text', ''))
        location_text = state.get('location', {}).get('raw_text', 'Unknown')
        victim_count = state.get('victim_count', 1)

        if self.llm_available and HumanMessage is not None:
            format_instructions = self.parser.get_format_instructions()
            prompt = f"""You are a senior emergency call analyst. Evaluate the following call transcript for authenticity.
Consider:
(1) Linguistic markers of distress vs performance (genuine panic vs rehearsed script),
(2) Geographical plausibility of the reported incident,
(3) Consistency between victim count, incident type, and described situation,
(4) Presence of background sounds described in transcript,
(5) Plausibility of details.

Call Transcript: {transcript}
Location: {location_text}
Incident Type: {state.get('incident_type', {}).get('category', 'Unknown')}
Victim Count: {victim_count}

{format_instructions}"""
            try:
                # Try LLM with 8-second timeout
                response = await asyncio.wait_for(
                    self.invoke_llm([HumanMessage(content=prompt)]),
                    timeout=8.0
                )
                validation_data = self.parser.parse(response.content)
            except asyncio.TimeoutError:
                state["errors"].append("Validation LLM timed out (8s). Using rule-based fallback.")
            except Exception as exc:
                state["errors"].append(f"Validation LLM failed: {exc}. Using rule-based fallback.")

        if validation_data is None:
            # Rule-based fallback
            validation_method = "rule_based"
            score, reasons = self.rule_based_authenticity(transcript, location_text, victim_count)
            
            action = "DISPATCH"
            if score < 45:
                action = "REVIEW"
            elif score < 70:
                action = "INVESTIGATE"
                
            validation_data = {
                "authenticity_score": score,
                "reasoning": reasons if reasons else ["Rule-based analysis inconclusive."],
                "recommended_action": action,
                "confidence": "MEDIUM" if score > 50 else "LOW",
                "validation_method": "rule_based"
            }
        else:
            validation_data["validation_method"] = "llm"

        score = validation_data.get("authenticity_score", 0)
        final_score = max(0.0, min(1.0, float(score) / 100.0))
        
        # If score < 45, force action to REVIEW and add flag
        if score < 45:
            validation_data["recommended_action"] = "REVIEW"
        
        requires_callback = score < 45
        flags = state.get("validation_flags", [])
        if requires_callback:
            if "review_required" not in flags:
                flags.append("review_required")

        # Save result for AgentFeed
        state["agent_trail"].append(
            {
                "agent": "validation",
                "timestamp": datetime.now(),
                "decision": validation_data.get("recommended_action", "DISPATCH"),
                "reasoning": json.dumps(validation_data), # AgentFeed parses this
            }
        )

        return {
            **state,
            "confidence_score": final_score,
            "validation_flags": flags,
            "requires_callback": requires_callback,
        }
