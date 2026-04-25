import json
from datetime import datetime
from typing import List, Literal

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class ValidationResult(BaseModel):
    authenticity_score: int = Field(description="Authenticity score from 0 to 100")
    reasoning: List[str] = Field(description="3-5 bullet points explaining your conclusion")
    recommended_action: Literal["DISPATCH", "HOLD", "INVESTIGATE"] = Field(description="Recommended action based on score")
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(description="Confidence in your assessment")

class ValidationAgent(BaseAgent):
    """Deep agentic prank/hoax detection."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ValidationResult)

    async def process(self, state: dict) -> dict:
        validation_data = None

        if self.llm_available and HumanMessage is not None:
            format_instructions = self.parser.get_format_instructions()
            prompt = f"""You are a senior emergency call analyst. Evaluate the following call transcript for authenticity.
Consider:
(1) Linguistic markers of distress vs performance (genuine panic vs rehearsed script),
(2) Geographical plausibility of the reported incident,
(3) Consistency between victim count, incident type, and described situation,
(4) Presence of background sounds described in transcript (silence during reported explosions is suspicious),
(5) Repeat call patterns from same location in last 30 minutes.

Call Transcript: {state.get('raw_transcript', state.get('normalized_text', ''))}
Location: {state.get('location', {}).get('raw_text', 'Unknown')}
Incident Type: {state.get('incident_type', {}).get('category', 'Unknown')}
Victim Count: {state.get('victim_count', 1)}

{format_instructions}"""
            try:
                response = await self.invoke_llm([HumanMessage(content=prompt)])
                validation_data = self.parser.parse(response.content)
            except Exception as exc:
                state["errors"].append(f"Validation LLM fallback triggered: {exc}")

        if validation_data is None:
            # Fallback if LLM fails: Assume 100 to prevent false negatives
            validation_data = {
                "authenticity_score": 100,
                "reasoning": ["LLM processing failed; defaulting to maximum authenticity to prevent false negatives."],
                "recommended_action": "DISPATCH",
                "confidence": "LOW"
            }

        score = validation_data.get("authenticity_score", 100)
        final_score = max(0.0, min(1.0, float(score) / 100.0))
        
        requires_callback = score < 40
        flags = ["review_required"] if requires_callback else []

        # Save JSON output explicitly in reasoning so AgentFeed can parse it
        json_output = json.dumps(validation_data)

        state["agent_trail"].append(
            {
                "agent": "validation",
                "timestamp": datetime.now(),
                "decision": validation_data.get("recommended_action", "DISPATCH"),
                "reasoning": json_output,
            }
        )

        return {
            **state,
            "confidence_score": final_score,
            "validation_flags": flags,
            "requires_callback": requires_callback,
        }
