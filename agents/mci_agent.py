from typing import Optional
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class MCIResponse(BaseModel):
    mutual_aid_request: str = Field(description="Requesting X resources from adjacent districts")
    hospital_alert: str = Field(description="Alerting nearest government hospital to activate mass casualty plan")
    media_advisory_draft: str = Field(description="Public media advisory draft")
    resource_gap_analysis: str = Field(description="Deficit of resources vs demand")

class MCIAgent(BaseAgent):
    """Generates NDMA-compliant Mass Casualty Incident (MCI) protocols."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=MCIResponse)

    async def generate_mci_response(self, zone: str, active_incidents: int, resources: dict) -> Optional[dict]:
        if not self.llm_available or HumanMessage is None:
            # Fallback
            return {
                "mutual_aid_request": "Requesting 5 additional ambulances and 2 fire trucks from adjacent districts.",
                "hospital_alert": "ALERT: Activate Mass Casualty Plan. Expecting 15+ casualties within 30 minutes.",
                "media_advisory_draft": f"Emergency declared in {zone}. Please avoid the area to allow emergency vehicles access.",
                "resource_gap_analysis": f"Current load: {active_incidents} incidents. Severe deficit in trauma transport."
            }

        prompt = f"""MCI protocol activated for {zone}. 
Current resources available: {resources}. 
Current demand: {active_incidents} high-priority active incidents. 

India NDMA MCI protocol requires: 
1. Requesting mutual aid from adjacent districts.
2. Activating NGO ambulance networks (St. John Ambulance, Red Cross).
3. Alerting nearest government hospital to activate their mass casualty plan.

Generate a comprehensive response strategy based on this criteria.

{self.parser.get_format_instructions()}"""

        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            return self.parser.parse(response.content)
        except Exception as exc:
            print(f"MCI LLM generation failed: {exc}")
            return {
                "mutual_aid_request": "Requesting 5 additional ambulances and 2 fire trucks from adjacent districts.",
                "hospital_alert": "ALERT: Activate Mass Casualty Plan. Expecting 15+ casualties within 30 minutes.",
                "media_advisory_draft": f"Emergency declared in {zone}. Please avoid the area to allow emergency vehicles access.",
                "resource_gap_analysis": f"Current load: {active_incidents} incidents. Severe deficit in trauma transport."
            }
