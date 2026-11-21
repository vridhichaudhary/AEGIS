from collections import Counter


class ReportAgent:
    """Generate a simulation report from recorded decisions and timestamps."""

    async def generate_report(self, incidents: list[dict]) -> dict | None:
        if not incidents:
            return None

        records = sorted(incidents, key=lambda incident: incident.get("timestamp") or "")
        priorities = Counter(incident.get("priority") for incident in records)
        resolved = sum(incident.get("status") == "RESOLVED" for incident in records)
        assignments = sum(len(incident.get("assigned_resources", [])) for incident in records)
        shortfalls = sum(
            item["quantity"] for incident in records for item in incident.get("resource_shortfall", [])
        )
        callbacks = sum(incident.get("requires_callback", False) for incident in records)
        timeline = []
        for incident in records:
            reference = incident["incident_id"][:8].upper()
            for entry in incident.get("agent_trail", []):
                if entry["agent"] in {"dispatch", "operator"}:
                    timeline.append({"timestamp": entry["timestamp"], "event": f"{reference} · {entry['decision']}"})
            timeline.append({"timestamp": incident["timestamp"], "event": f"{reference} · Report received"})

        return {
            "executive_summary": f"{len(records)} simulated reports, {priorities['P1']} priority-one cases and {resolved} closures.",
            "incident_timeline": sorted(timeline, key=lambda event: event["timestamp"]),
            "resource_deployment_analysis": f"{assignments} recorded unit assignments and {shortfalls} unfilled unit requests.",
            "response_time_performance": "Field arrival times were not recorded during the simulation.",
            "decision_quality_audit": f"{callbacks} reports currently require a location follow-up.",
            "golden_hour_performance": "Patient transport and treatment timestamps were not recorded.",
            "recommendations": [],
        }
