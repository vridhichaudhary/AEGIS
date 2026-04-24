import unittest
from datetime import datetime

from fastapi.testclient import TestClient

from agents.parsing_agent import ParsingAgent
from agents.supervisor import SupervisorAgent
from api.main import app


class ParsingAgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_parsing_agent_hindi(self):
        agent = ParsingAgent()
        state = {
            "normalized_text": "Aag lagi hai Sector 14 mein! 5 log faase hain!",
            "language_code": "hi",
            "agent_trail": [],
            "errors": [],
            "timestamp": datetime.now(),
        }

        result = await agent.process(state)

        self.assertEqual(result["incident_type"]["category"], "fire")
        self.assertGreaterEqual(result["victim_count"], 5)
        self.assertEqual(result["location"]["raw_text"], "Sector 14")


class SupervisorTests(unittest.IsolatedAsyncioTestCase):
    async def test_supervisor_processes_critical_medical_call(self):
        supervisor = SupervisorAgent()

        result = await supervisor.process_call(
            "My father is unconscious near DLF Mall and may be having a heart attack. Please send help now!"
        )

        self.assertIn(result["priority"], {"P1", "P2"})
        self.assertFalse(result["requires_callback"])
        self.assertTrue(result["assigned_resources"])
        self.assertEqual(result["incident_type"]["category"], "medical")

    async def test_supervisor_flags_prank_call_for_callback(self):
        supervisor = SupervisorAgent()

        result = await supervisor.process_call("Hello? Is this working? Testing...")

        self.assertTrue(result["requires_callback"])
        self.assertEqual(result["dispatch_status"], "pending")


class ApiTests(unittest.TestCase):
    def test_health_and_report_routes(self):
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
        self.assertIn(payload["priority"], {"P1", "P2", "P3"})
        self.assertIsInstance(payload["assigned_resources"], list)

        incidents_response = client.get("/api/v1/incidents/active")
        self.assertEqual(incidents_response.status_code, 200)
        self.assertGreaterEqual(len(incidents_response.json()["incidents"]), 1)


if __name__ == "__main__":
    unittest.main()
