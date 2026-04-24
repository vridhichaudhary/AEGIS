import unittest
from datetime import datetime

from fastapi.testclient import TestClient

from agents.parsing_agent import ParsingAgent
from agents.supervisor import SupervisorAgent
from api.main import app


class ParsingAgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_parsing_agent_handles_hinglish_fire(self):
        agent = ParsingAgent()
        state = {
            "normalized_text": "Aag lagi hai Sector 14 mein! 5 log faase hain!",
            "language_code": "hi-en",
            "agent_trail": [],
            "errors": [],
            "timestamp": datetime.now(),
        }

        result = await agent.process(state)

        self.assertEqual(result["incident_type"]["category"], "fire")
        self.assertGreaterEqual(result["victim_count"], 5)
        self.assertEqual(result["location"]["raw_text"], "Sector 14")

    async def test_parsing_agent_handles_obstetric_emergency(self):
        agent = ParsingAgent()
        state = {
            "normalized_text": "Meri wife ko labor pain shuru ho gaya hai, paani toot gaya, Sector 9 Rohini",
            "language_code": "hi-en",
            "agent_trail": [],
            "errors": [],
            "timestamp": datetime.now(),
        }

        result = await agent.process(state)
        self.assertEqual(result["incident_type"]["category"], "medical")
        self.assertEqual(result["incident_type"]["subcategory"], "obstetric_emergency")
        self.assertEqual(result["location"]["raw_text"], "Sector 9 Rohini")


class SupervisorFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_core_flow_preserves_stage_order(self):
        supervisor = SupervisorAgent()
        result = await supervisor.process_call(
            "NH 48 par bada accident ho gaya hai, 3 gaadi takra gayi, ek aadmi khoon beh raha hai aur ek behosh hai"
        )

        self.assertEqual(result["incident_type"]["category"], "accident")
        self.assertEqual(result["priority"], "P1")
        self.assertFalse(result["requires_callback"])
        self.assertTrue(result["assigned_resources"])
        self.assertEqual(
            [event["agent"] for event in result["agent_trail"]],
            ["ingestion", "parsing", "deduplication", "validation", "triage", "dispatch", "feedback"],
        )

    async def test_critical_missing_location_keeps_flow_but_holds_dispatch(self):
        supervisor = SupervisorAgent()
        result = await supervisor.process_call("Heart attack ho raha hai, please ambulance bhejo jaldi")

        self.assertEqual(result["incident_type"]["category"], "medical")
        self.assertEqual(result["priority"], "P1")
        self.assertTrue(result["requires_callback"])
        self.assertEqual(result["dispatch_status"], "awaiting_location")
        self.assertEqual(result["assigned_resources"], [])

    async def test_duplicate_incidents_are_merged(self):
        supervisor = SupervisorAgent()
        first = await supervisor.process_call("Sector 22 market mein gas cylinder blast hua hai, 2 log jal gaye")
        second = await supervisor.process_call("Sector 22 market ke paas cylinder phat gaya, do log burn hue hain")

        self.assertFalse(first["is_duplicate"])
        self.assertTrue(second["is_duplicate"])
        self.assertEqual(second["duplicate_of"], first["incident_id"])

    async def test_flood_scenario_is_high_priority(self):
        supervisor = SupervisorAgent()
        result = await supervisor.process_call(
            "Yamuna ka paani gharon mein ghus gaya hai, bachche chhat par phase hain, rescue team bhejo"
        )

        self.assertEqual(result["incident_type"]["category"], "natural_disaster")
        self.assertEqual(result["priority"], "P1")
        self.assertEqual(result["dispatch_status"], "awaiting_location")
        self.assertTrue(result["requires_callback"])

    async def test_prank_call_is_suppressed(self):
        supervisor = SupervisorAgent()
        result = await supervisor.process_call("Hello testing 112 line working hai kya")

        self.assertEqual(result["priority"], "P5")
        self.assertEqual(result["dispatch_status"], "not_required")
        self.assertTrue(result["requires_callback"])


class ApiTests(unittest.TestCase):
    def test_health_report_and_active_incidents_routes(self):
        client = TestClient(app)

        health_response = client.get("/health")
        self.assertEqual(health_response.status_code, 200)
        self.assertEqual(health_response.json()["status"], "healthy")

        report_response = client.post(
            "/api/v1/emergency/report",
            json={"transcript": "Fire in Sector 14, five people trapped on third floor."},
        )
        self.assertEqual(report_response.status_code, 200)
        payload = report_response.json()
        self.assertEqual(payload["priority"], "P1")
        self.assertIsInstance(payload["assigned_resources"], list)

        incidents_response = client.get("/api/v1/incidents/active")
        self.assertEqual(incidents_response.status_code, 200)
        self.assertGreaterEqual(len(incidents_response.json()["incidents"]), 1)

    def test_simulation_route_accepts_requests(self):
        client = TestClient(app)
        response = client.post("/api/v1/simulation/run?scenario=normal&count=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["queued"], 2)


if __name__ == "__main__":
    unittest.main()
