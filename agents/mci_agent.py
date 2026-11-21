from agents.report_agent import ReportAgent


class MCIAgent:
    """Summarize simulated surge conditions and exercise capacity."""

    async def generate_mci_response(self, zone: str, active_incidents: int, resources: dict) -> dict:
        ambulances = resources.get("ambulances_available", 0)
        fire_trucks = resources.get("fire_trucks_available", 0)
        return {
            "mutual_aid_request": "Review unfilled assignments before requesting simulated mutual aid.",
            "hospital_alert": "Check current simulated hospital capacity.",
            "media_advisory_draft": f"Exercise scenario: surge review for {zone}.",
            "resource_gap_analysis": f"{active_incidents} recent reports, {ambulances} ambulances and {fire_trucks} fire units available.",
        }

    async def generate_aar_report(self, zone: str, incident_data: list) -> dict:
        report = await ReportAgent().generate_report(incident_data)
        if report:
            return {**report, "executive_summary": f"Surge exercise in {zone}. {report['executive_summary']}"}
        return {"executive_summary": f"The simulated surge window for {zone} has ended.", "incident_timeline": []}
