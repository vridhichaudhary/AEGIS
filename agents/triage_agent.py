from langchain_core.messages import HumanMessage
from agents.base_agent import BaseAgent
from datetime import datetime
import json

class TriageAgent(BaseAgent):
    """P1-P5 priority assignment using FREE Gemini"""
    
    def __init__(self):
        super().__init__(temperature=0)
    
    async def process(self, state: dict) -> dict:
        """Execute triage using FREE Gemini"""
        
        prompt = f"""You are the Chief Triage Officer for India's National Emergency Response.

TASK: Assign priority P1-P5 and determine required resources.

INCIDENT DATA:
Call: "{state['normalized_text']}"
Location: {state['location']['raw_text']}
Type: {state['incident_type']['category']}
Victims: {state['victim_count']}
Distress: {state['distress_score']:.2f}
Confidence: {state['confidence_score']:.2f}

PRIORITY LEVELS (NDRF Protocol):

P1 - IMMEDIATE (Red):
- Cardiac arrest, severe bleeding, unconscious
- Fire with entrapment
- Major trauma, severe accidents
- Childbirth complications
→ Dispatch: <60 seconds

P2 - URGENT (Orange):
- Moderate bleeding, fractures
- Burns (non-critical)
- Breathing difficulty (stable)
→ Dispatch: <5 minutes

P3 - NON-URGENT (Yellow):
- Minor injuries, sprains
- Stable illness
→ Dispatch: <15 minutes

P4 - ROUTINE (Green):
- Very minor issues
- Property damage only
→ Dispatch: when available

P5 - INFO ONLY (White):
- Non-emergency calls
- Information requests
→ No dispatch

RESOURCES:
- ambulance (basic medical transport)
- ambulance_cardiac (heart emergencies)
- ambulance_trauma (severe injuries)
- fire_truck (fire response)
- fire_truck_rescue (entrapment/collapse)
- police (violence/security)
- rescue_team (disasters)

Return ONLY valid JSON:
{{
  "priority_level": "P1|P2|P3|P4|P5",
  "priority_justification": "brief explanation",
  "required_resources": [
    {{"type": "ambulance", "quantity": 1, "specialized": false}}
  ],
  "estimated_severity": "critical|serious|moderate|minor",
  "immediate_actions": ["action1", "action2"]
}}

JSON OUTPUT:"""

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            content = response.content.strip()
            
            # Clean markdown
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            
            triage_data = json.loads(content)
            
            # Convert priority to numeric score
            priority_scores = {"P1": 5.0, "P2": 4.0, "P3": 3.0, "P4": 2.0, "P5": 1.0}
            priority_score = priority_scores.get(triage_data["priority_level"], 3.0)
            
            # Apply distress multiplier
            priority_score += state["distress_score"] * 0.5
            
            # Log
            state["agent_trail"].append({
                "agent": "triage",
                "timestamp": datetime.now(),
                "decision": f"Assigned {triage_data['priority_level']}",
                "reasoning": triage_data["priority_justification"]
            })
            
            return {
                **state,
                "priority": triage_data["priority_level"],
                "priority_score": priority_score,
                "resource_requirements": triage_data["required_resources"],
                "estimated_severity": triage_data["estimated_severity"],
                "triage_reasoning": triage_data["priority_justification"]
            }
            
        except Exception as e:
            state["errors"].append(f"Triage failed: {str(e)}")
            return {
                **state,
                "priority": "P2",
                "priority_score": 4.0,
                "resource_requirements": [{"type": "ambulance", "quantity": 1, "specialized": False}],
                "estimated_severity": "Unknown",
                "triage_reasoning": f"Auto-triage failed: {str(e)}"
            }