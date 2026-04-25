from __future__ import annotations
import json
from typing import Optional
from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage


class CommandAgent(BaseAgent):
    """Voice command interface agent — parses natural language dispatcher queries."""

    def __init__(self):
        super().__init__(temperature=0)

    async def process_command(
        self,
        transcript: str,
        language: str,
        active_incidents: list,
        resources: list,
    ) -> dict:
        # Graceful LLM fallback
        if not self.llm_available or HumanMessage is None:
            return {
                "spoken_response": "I'm sorry, my natural language processor is currently offline.",
                "action": {"action_type": "none", "parameters": {}},
            }

        # Summarise live state for the prompt
        p1_count = sum(1 for i in active_incidents if i.get("priority") == "P1")
        p2_count = sum(1 for i in active_incidents if i.get("priority") == "P2")
        active_count = len(active_incidents)
        dispatched_count = sum(
            len(i.get("assigned_resources", [])) for i in active_incidents
        )

        system_context = (
            f"System State:\n"
            f"- Total Active Incidents: {active_count}\n"
            f"- P1 Critical Incidents: {p1_count}\n"
            f"- P2 Serious Incidents: {p2_count}\n"
            f"- Total Dispatched Resources: {dispatched_count}\n"
        )

        lang_hint = (
            "Reply in conversational Hindi/Hinglish."
            if language == "hi-IN"
            else "Reply in clear English."
        )

        prompt = (
            f"You are JARVIS for AEGIS, a mission-control AI assistant for emergency dispatch.\n"
            f"Answer the dispatcher's voice command based on the current system state.\n"
            f"Keep your spoken response highly concise and natural for a Text-to-Speech engine. {lang_hint}\n\n"
            f"{system_context}\n"
            f"Dispatcher Command: \"{transcript}\"\n\n"
            f"Respond with a JSON object with exactly two keys:\n"
            f"- spoken_response: a short string to be spoken aloud\n"
            f"- action_type: one of 'none', 'redirect_unit', 'close_incident'\n"
            f"Example: {{\"spoken_response\": \"There are {p1_count} critical P1 incidents active.\", \"action_type\": \"none\"}}"
        )

        try:
            response = await self.invoke_llm([HumanMessage(content=prompt)])
            content = response.content.strip()

            # Strip markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            parsed = json.loads(content)
            return {
                "spoken_response": parsed.get(
                    "spoken_response", "Command processed."
                ),
                "action": {
                    "action_type": parsed.get("action_type", "none"),
                    "parameters": parsed.get("parameters", {}),
                },
            }
        except Exception as exc:
            print(f"[CommandAgent] LLM parse error: {exc}")
            # Provide a meaningful fallback using pre-computed state
            return {
                "spoken_response": (
                    f"Currently tracking {active_count} incidents, "
                    f"including {p1_count} critical P1 cases."
                ),
                "action": {"action_type": "none", "parameters": {}},
            }
