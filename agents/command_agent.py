from __future__ import annotations
import json
from typing import Optional, Dict
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class CommandAction(BaseModel):
    action_type: str = Field(description="Type of action (e.g., 'redirect_unit', 'close_incident', 'none')")
    parameters: dict = Field(description="Parameters for the action")

class CommandResponse(BaseModel):
    spoken_response: str = Field(description="A highly concise, natural-sounding reply for Text-to-Speech")
    action: Optional[CommandAction] = Field(description="Optional dispatch action to execute")

class CommandAgent(BaseAgent):
    """Voice command interface agent."""

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=CommandResponse)

    async def process_command(self, transcript: str, language: str, active_incidents: list, resources: list) -> dict:
        if not self.llm_available or HumanMessage is None:
            return {
                "spoken_response": "I'm sorry, my natural language processor is currently offline.",
                "action": {"action_type": "none", "parameters": {}}
            }
            
        # Summarize state for the prompt
        p1_count = len([i for i in active_incidents if i.get("priority") == "P1"])
        active_count = len(active_incidents)
        available_ambulances = len([r for r in resources if "ambulance" in r.get("type", "").lower() and r.get("status") == "available"])
        dispatched_resources = len([r for r in resources if r.get("status") == "dispatched"])
        
        system_context = f"""
System State:
- Total Active Incidents: {active_count}
- P1 Critical Incidents: {p1_count}
- Available Ambulances: {available_ambulances}
- Dispatched Resources: {dispatched_resources}
"""

        prompt = f"""You are JARVIS for AEGIS, a mission-control AI assistant for emergency dispatch.
Answer the dispatcher's voice command based on the current system state. Keep your spoken response highly concise and natural for a Text-to-Speech engine. Output the spoken response in the requested language ({language}). If the language is hi-IN, reply in conversational Hindi/Hinglish.

{system_context}

Dispatcher Command: "{transcript}"

{self.parser.get_format_instructions()}"""

        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            parsed = self.parser.parse(response.content)
            return parsed
        except Exception as exc:
            print(f"Command LLM fallback triggered: {exc}")
            return {
                "spoken_response": "I encountered an error processing your command.",
                "action": {"action_type": "none", "parameters": {}}
            }
