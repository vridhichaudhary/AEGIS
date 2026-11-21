import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from fastapi.testclient import TestClient

from agents.dispatch_agent import DispatchAgent
from agents.parsing_agent import ParsingAgent
from agents.supervisor import SupervisorAgent
import api.main as api
from api.main import app
from db import database as db
from state import hospitals


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


class RoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_osrm_response_supplies_the_displayed_road_eta_and_geometry(self):
        geometry = [[77.20, 28.61], [77.21, 28.63]]
        response = MagicMock(status=200)
        response.json = AsyncMock(return_value={
            "routes": [{"duration": 720, "distance": 3100, "geometry": {"coordinates": geometry}}],
        })
        session = MagicMock()
        session.get.return_value.__aenter__.return_value = response
        with patch("agents.dispatch_agent.aiohttp.ClientSession") as factory:
            factory.return_value.__aenter__.return_value = session
            route = await DispatchAgent().get_osrm_eta(28.61, 77.20, 28.63, 77.21)
        self.assertEqual(route["eta_minutes"], 12)
        self.assertEqual(route["route_geometry"], geometry)
        self.assertEqual(route["route_source"], "osrm")


class ApiTests(unittest.TestCase):
    def setUp(self):
        database = self.enterContext(TemporaryDirectory())
        self.enterContext(patch.object(db, "DB_PATH", str(Path(database) / "test.db")))
        self.enterContext(patch.object(api, "active_incidents", {}))
        self.enterContext(patch.object(api, "CALLBACK_QUEUE", []))
        self.enterContext(patch.object(api, "CALLBACK_METRICS", {"total_pending": 0, "total_resolved": 0}))
        self.enterContext(patch.object(api, "supervisor", SupervisorAgent()))
        self.enterContext(patch.object(hospitals, "_unit_assignments", {}))
        self.client = self.enterContext(TestClient(app))

    def test_health_report_and_active_incidents_routes(self):
        client = self.client

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
        client = self.client
        response = client.post("/api/v1/simulation/run?scenario=normal&count=2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["queued"], 2)

    def test_callback_updates_the_same_report_and_releases_the_fleet(self):
        client = self.client
        before = client.get("/api/v1/resources").json()
        report = client.post("/api/v1/emergency/report", json={
            "transcript": "Heart attack, please send help near Fictional Sunrise Hospital!",
        }).json()
        incident_id = report["incident_id"]
        self.assertEqual(report["dispatch_status"], "awaiting_location")
        self.assertIsNone(report["location"]["latitude"])
        self.assertEqual(client.get("/api/v1/callbacks").json()["callbacks"][0]["incident_id"], incident_id)

        still_pending = client.post(f"/api/v1/callback/{incident_id}/response", json={
            "additional_info": "I don't know the street name.",
        }).json()
        self.assertEqual(still_pending["incident_id"], incident_id)
        self.assertTrue(still_pending["requires_callback"])

        updated = client.post(f"/api/v1/callback/{incident_id}/response", json={
            "location": {"latitude": 28.63, "longitude": 77.21},
        }).json()
        self.assertEqual(updated["incident_id"], incident_id)
        self.assertEqual(updated["location"]["source"], "operator_pin")
        self.assertEqual(updated["location"]["latitude"], 28.63)
        self.assertEqual(updated["dispatch_status"], "assigned")
        self.assertTrue(updated["destination_hospital"])
        self.assertEqual(client.get("/api/v1/callbacks").json()["callbacks"], [])
        self.assertEqual(len(client.get("/api/v1/incidents/history").json()["incidents"]), 1)

        with client.websocket_connect("/ws") as socket:
            snapshot = socket.receive_json()
            self.assertEqual(snapshot["type"], "snapshot")
            self.assertEqual(len(snapshot["payload"]["resources"]), len(before["resources"]))
            self.assertEqual(snapshot["payload"]["incidents"][0]["location"]["source"], "operator_pin")

        resolved = client.post(f"/api/v1/incidents/{incident_id}/resolve").json()
        self.assertEqual(resolved["freed"], 1)
        self.assertEqual(client.post(f"/api/v1/incidents/{incident_id}/resolve").json()["freed"], 0)
        after = client.get("/api/v1/resources").json()
        self.assertEqual(before, after)
        self.assertEqual(client.get("/api/v1/incidents/active").json()["incidents"], [])
        report = client.get("/api/v1/report/generate").json()
        self.assertIn("1 closures", report["executive_summary"])
        self.assertTrue(any(event["event"].endswith("Resolved") for event in report["incident_timeline"]))

    def test_whatsapp_pin_drives_dispatch_and_duplicate_detection(self):
        request = {
            "from": "demo",
            "type": "location",
            "text": {"body": "Heart attack, patient is unconscious. Please send an ambulance."},
            "location": {"latitude": 28.6304, "longitude": 77.2177},
        }
        first = self.client.post("/api/v1/webhook/whatsapp", json=request).json()
        self.assertEqual(first["location"]["source"], "shared_pin")
        self.assertEqual(first["dispatch_status"], "assigned")
        self.assertEqual(first["assigned_resources"][0]["route_geometry"][-1], [77.2177, 28.6304])
        second = self.client.post("/api/v1/webhook/whatsapp", json=request).json()
        self.assertEqual(second["duplicate_of"], first["incident_id"])
        self.assertEqual(second["assigned_resources"], [])
        self.assertNotIn("units assigned", second["whatsapp_reply"])
        request["location"]["latitude"] = 180
        self.assertEqual(self.client.post("/api/v1/webhook/whatsapp", json=request).status_code, 422)

    def test_geocoding_preserves_city_qualifiers_and_is_repeatable(self):
        client = self.client
        original = {"transcript": "Fire with people trapped at Sector 18 Noida."}
        unlabeled = client.post("/api/v1/emergency/report", json={
            "transcript": "Fire with people trapped at Sector 18.",
        }).json()
        self.assertEqual(unlabeled["dispatch_status"], "awaiting_location")
        first = client.post("/api/v1/emergency/report", json=original).json()
        second = client.post("/api/v1/emergency/report", json=original).json()
        self.assertEqual(first["location"], second["location"])
        self.assertEqual(first["location"]["raw_text"], "Sector 18 Noida")
        self.assertEqual(first["location"]["longitude"], 77.3251)
        self.assertEqual(second["dispatch_status"], "merged_duplicate")

    def test_operator_review_confirms_category_on_original_incident(self):
        report = self.client.post("/api/v1/emergency/report", json={
            "transcript": "Please help at Connaught Place.",
        }).json()
        self.assertEqual(report["dispatch_status"], "review_required")
        incident_id = report["incident_id"]
        reviewed = self.client.post(f"/api/v1/incidents/{incident_id}/review", json={"category": "medical"}).json()
        self.assertEqual(reviewed["incident_id"], incident_id)
        self.assertEqual(reviewed["incident_type"]["category"], "medical")
        self.assertEqual(reviewed["dispatch_status"], "assigned")
        self.assertEqual(len(self.client.get("/api/v1/incidents/active").json()["incidents"]), 1)

    def test_out_of_area_pin_does_not_assign_a_delhi_unit(self):
        report = self.client.post("/api/v1/emergency/report", json={
            "transcript": "Heart attack. Send an ambulance.",
            "location": {"latitude": 19.07, "longitude": 72.87},
        }).json()
        self.assertEqual(report["location"]["source"], "shared_pin")
        self.assertEqual(report["dispatch_status"], "outside_service_area")
        self.assertEqual(report["assigned_resources"], [])

    def test_image_without_caption_does_not_create_an_incident(self):
        response = self.client.post("/api/v1/webhook/whatsapp", json={"type": "image", "image": {"link": "demo.jpg"}})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/v1/incidents/active").json()["incidents"], [])


if __name__ == "__main__":
    unittest.main()
