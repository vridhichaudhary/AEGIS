from __future__ import annotations
import json
from typing import List, Literal, Optional
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class CascadePrediction(BaseModel):
    description: str = Field(description="Description of the likely next incident")
    confidence_percentage: int = Field(description="Confidence percentage (0-100)")

class PrepositionOrder(BaseModel):
    resource_type: str = Field(description="Type of resource (e.g., 'ambulance', 'fire_truck', 'police')")
    destination: str = Field(description="Where to pre-position")
    reason: str = Field(description="Why this is needed")

class ThreatIntelligence(BaseModel):
    risk_zones: List[str] = Field(description="List of areas with predicted risk")
    cascade_predictions: List[CascadePrediction] = Field(description="List of likely next incidents with confidence")
    preposition_orders: List[PrepositionOrder] = Field(description="Specific resource movements to make now")
    threat_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(description="Overall threat level")

class CascadePredictionAgent(BaseAgent):
    """Proactive disaster intelligence analyst."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ThreatIntelligence)

    async def analyze(self, incidents: List[dict]) -> Optional[dict]:
        if not self.llm_available or HumanMessage is None:
            return None
            
        if not incidents:
            return {
                "risk_zones": [],
                "cascade_predictions": [],
                "preposition_orders": [],
                "threat_level": "LOW"
            }

        incident_list_str = "\n".join([
            f"- {i.get('incident_type', {}).get('category', 'unknown')} at {i.get('location', {}).get('raw_text', 'unknown')} ({i.get('priority', 'unknown')})" 
            for i in incidents
        ])

        prompt = f"""You are a disaster intelligence analyst. Analyze the following active incidents in the last 15 minutes:
{incident_list_str}

Identify:
(1) Geographic clustering — are multiple incidents happening in the same zone?
(2) Temporal patterns — are incidents of similar type escalating in frequency?
(3) Cascade risks — what secondary emergencies are likely to emerge in the next 30 minutes based on these patterns?
(4) Pre-positioning recommendation — which resources should be moved NOW to be ready for predicted incidents?

{self.parser.get_format_instructions()}"""

        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            return self.parser.parse(response.content)
        except Exception as exc:
            print(f"Cascade LLM fallback triggered: {exc}")
            return None
