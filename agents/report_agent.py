from __future__ import annotations
import json
from typing import List, Optional
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class TimelineEvent(BaseModel):
    timestamp: str = Field(description="Time of the event")
    event: str = Field(description="Description of the event")

class ReportData(BaseModel):
    executive_summary: str = Field(description="Executive Summary (2 paragraphs)")
    incident_timeline: List[TimelineEvent] = Field(description="Chronological table of all events")
    resource_deployment_analysis: str = Field(description="Utilization rates, gaps")
    response_time_performance: str = Field(description="Performance vs national benchmarks of 8 min urban, 15 min rural")
    decision_quality_audit: str = Field(description="Were triage decisions correct? any missed escalations?")
    golden_hour_performance: str = Field(description="What % of critical cases met the standard?")
    recommendations: List[str] = Field(description="3-5 specific, actionable items")

class ReportAgent(BaseAgent):
    """Generates an After-Action Report (AAR)."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ReportData)

    async def generate_report(self, incidents: List[dict]) -> Optional[dict]:
        if not self.llm_available or HumanMessage is None:
            return None
            
        if not incidents:
            return None

        clean_incidents = []
        for inc in incidents:
            clean_incidents.append({
                "incident_id": inc.get("incident_id"),
                "priority": inc.get("priority"),
                "status": inc.get("status"),
                "location": inc.get("location", {}).get("raw_text", "unknown"),
                "type": inc.get("incident_type", {}).get("category", "unknown"),
                "resources": len(inc.get("assigned_resources", [])),
                "golden_hour_risk": inc.get("golden_hour_at_risk", False)
            })

        simulation_data = json.dumps(clean_incidents)

        prompt = f"""You are a senior emergency management analyst. Generate a formal After-Action Report (AAR) in the format used by India's National Disaster Management Authority (NDMA).
Use the following incident data:
{simulation_data}

{self.parser.get_format_instructions()}"""

        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            return self.parser.parse(response.content)
        except Exception as exc:
            print(f"Report LLM fallback triggered: {exc}")
            return None
