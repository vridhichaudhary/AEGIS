from __future__ import annotations
import json
from typing import List, Optional
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage


class ReportAgent(BaseAgent):
    """Generates an NDMA-formatted After-Action Report (AAR)."""

    def __init__(self):
        super().__init__(temperature=0)

    async def generate_report(self, incidents: List[dict]) -> Optional[dict]:
        if not self.llm_available or HumanMessage is None:
            return None

        if not incidents:
            return None

        # Build condensed summary for the LLM (avoid token bloat)
        clean_incidents = []
        for inc in incidents:
            loc = inc.get("location")
            loc_text = (
                loc.get("raw_text", "unknown") if isinstance(loc, dict) else "unknown"
            )
            itype = inc.get("incident_type")
            itype_text = (
                itype.get("category", "unknown")
                if isinstance(itype, dict)
                else "unknown"
            )
            clean_incidents.append(
                {
                    "id": inc.get("incident_id", "")[:8],
                    "priority": inc.get("priority", "?"),
                    "status": inc.get("dispatch_status", inc.get("status", "?")),
                    "location": loc_text,
                    "type": itype_text,
                    "resources": len(inc.get("assigned_resources", [])),
                    "golden_hour_risk": inc.get("golden_hour_at_risk", False),
                }
            )

        simulation_data = json.dumps(clean_incidents, indent=2)

        prompt = f"""You are a senior emergency management analyst.
Generate a formal After-Action Report (AAR) for India's National Disaster Management Authority (NDMA).

Incident Data ({len(clean_incidents)} incidents):
{simulation_data}

Return a valid JSON object with EXACTLY these keys:
{{
  "executive_summary": "<2 paragraphs of high-level summary>",
  "incident_timeline": [
    {{"timestamp": "T+0 min", "event": "First incident reported at <location>"}},
    ...
  ],
  "resource_deployment_analysis": "<analysis of resource utilization and gaps>",
  "response_time_performance": "<comparison vs 8-min urban / 15-min rural national benchmarks>",
  "decision_quality_audit": "<were triage decisions correct? any missed escalations?>",
  "golden_hour_performance": "<what % of critical P1/P2 cases met the 60-minute standard?>",
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2",
    "Recommendation 3"
  ]
}}

Output ONLY the JSON object. No markdown fences, no extra text."""

        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            content = response.content.strip()

            # Strip markdown code fences if present
            if content.startswith("```"):
                lines = content.split("\n")
                # Remove first and last fence lines
                content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

            parsed = json.loads(content)

            # Ensure all required keys exist with sensible defaults
            return {
                "executive_summary": parsed.get("executive_summary", "Not generated."),
                "incident_timeline": parsed.get("incident_timeline", []),
                "resource_deployment_analysis": parsed.get("resource_deployment_analysis", "N/A"),
                "response_time_performance": parsed.get("response_time_performance", "N/A"),
                "decision_quality_audit": parsed.get("decision_quality_audit", "N/A"),
                "golden_hour_performance": parsed.get("golden_hour_performance", "N/A"),
                "recommendations": parsed.get("recommendations", []),
            }

        except json.JSONDecodeError as exc:
            print(f"[ReportAgent] JSON parse error: {exc}")
            return None
        except Exception as exc:
            print(f"[ReportAgent] LLM error: {exc}")
            return None
