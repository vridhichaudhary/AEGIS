import re


class CommandAgent:
    """Answer operational queries directly from the simulated incident and fleet state."""

    async def process_command(
        self, transcript: str, language: str, active_incidents: list, resources: list,
    ) -> dict:
        query = transcript.lower()
        critical = sum(incident.get("priority") == "P1" for incident in active_incidents)
        available = sum(unit.get("status") == "available" for unit in resources)
        assigned = sum(unit.get("status") == "dispatched" for unit in resources)
        callbacks = sum(bool(incident.get("requires_callback")) for incident in active_incidents)
        hindi = language == "hi-IN"

        if re.search(r"critical|\bp1\b|गंभीर", query):
            answer = f"{critical} गंभीर मामले सक्रिय हैं।" if hindi else f"{critical} critical P1 incidents are active."
        elif re.search(r"callback|location|स्थान", query):
            answer = f"{callbacks} रिपोर्टों के स्थान की पुष्टि बाकी है।" if hindi else f"{callbacks} reports need location follow-up."
        elif re.search(r"unit|resource|fleet|ambulance|वाहन", query):
            answer = f"{available} वाहन उपलब्ध हैं और {assigned} आवंटित हैं।" if hindi else f"{available} of {len(resources)} units are available. {assigned} are assigned."
        elif re.search(r"active|incident|status|घटना", query):
            answer = f"{len(active_incidents)} घटनाएँ सक्रिय हैं।" if hindi else f"{len(active_incidents)} incidents are active."
        else:
            answer = "सक्रिय घटनाओं, उपलब्ध वाहनों या स्थान की पुष्टि के बारे में पूछें।" if hindi else "Ask about active incidents, P1 cases, fleet availability, or location follow-ups."

        return {"spoken_response": answer, "action": {"action_type": "none", "parameters": {}}}
