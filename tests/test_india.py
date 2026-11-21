import unittest
from unittest.mock import patch, AsyncMock
import httpx
from agents.parsing_agent import ParsingAgent
from agents.dispatch_agent import DispatchAgent
from routing.geocoding import search_address
from config.settings import settings
from state.hospitals import find_nearest_available


def feature(city='Bengaluru', kind='street', lat=12.975, lng=77.606):
    return {'properties': {'country_code': 'in', 'city': city, 'state': 'Karnataka', 'postcode': '560001',
                           'formatted': f'MG Road, {city}, 560001, India', 'lat': lat, 'lon': lng, 'result_type': kind}}


class IndiaTests(unittest.IsolatedAsyncioTestCase):
    async def parse(self, text, pin=None):
        agent = ParsingAgent()
        return await agent.process({'normalized_text': text, 'agent_trail': [], 'errors': [], 'gps_override': pin})

    async def lookup(self, features):
        return httpx.Response(200, json={'features': features})

    async def test_qualified_addresses_preserve_city_state_pin(self):
        for address in ('MG Road, Bengaluru, Karnataka 560001', 'MG Road, Pune, Maharashtra 411001'):
            with patch.object(settings, 'GEOAPIFY_API_KEY', 'test-key'), patch('httpx.AsyncClient.get', new_callable=AsyncMock) as get:
                get.return_value = await self.lookup([feature('Pune', lat=18.512, lng=73.878) if 'Pune' in address else feature()])
                result = await self.parse('Fire at ' + address)
                self.assertIn(address, get.call_args.kwargs['params']['text'])
                self.assertEqual(get.call_args.kwargs['params']['filter'], 'countrycode:in')
                self.assertEqual(get.call_args.kwargs['params']['limit'], 5)
                self.assertTrue(result['requires_callback'])
                self.assertIsNone(result['location']['latitude'])
                self.assertTrue(result['location']['candidates'][0]['selectable'])

    async def test_ambiguous_mg_road_and_city_match_pending(self):
        with patch.object(settings, 'GEOAPIFY_API_KEY', 'test-key'), patch('httpx.AsyncClient.get', new_callable=AsyncMock) as get:
            get.return_value = await self.lookup([feature(), feature('Pune'), feature(kind='city')])
            result = await self.parse('Fire at MG Road')
            self.assertEqual(len(result['location']['candidates']), 3)
            self.assertFalse(result['location']['candidates'][2]['selectable'])
            self.assertTrue(result['requires_callback'])

    async def test_unknown_landmark_preserved(self):
        with patch.object(settings, 'GEOAPIFY_API_KEY', 'test-key'), patch('httpx.AsyncClient.get', new_callable=AsyncMock) as get:
            get.return_value = await self.lookup([])
            result = await self.parse('Fire at Zzyzx Unknown Landmark')
            self.assertTrue(result['requires_callback'])
            self.assertIn('Zzyzx', result['location']['raw_text'])
            self.assertEqual(result['location']['status'], 'no_match')

    async def test_gps_precedence(self):
        with patch('agents.parsing_agent.search_address', new_callable=AsyncMock) as search:
            for source in ('shared_pin', 'operator_pin'):
                result = await self.parse('Fire at MG Road', {'latitude': 18.52, 'longitude': 73.85, 'source': source})
                self.assertEqual(result['location']['latitude'], 18.52)
                self.assertEqual(result['location']['source'], source)
            search.assert_not_called()

    async def test_provider_failure_timeout_quota(self):
        with patch.object(settings, 'GEOAPIFY_API_KEY', 'test-key'), patch('httpx.AsyncClient.get', new_callable=AsyncMock) as get:
            for error in (httpx.TimeoutException('secret'), RuntimeError('secret')):
                get.side_effect = error
                result = await self.parse('Fire at MG Road')
                self.assertTrue(result['requires_callback'])
                self.assertNotIn('secret', str(result))
            get.side_effect = None
            get.return_value = httpx.Response(429)
            self.assertEqual((await search_address('MG Road'))['status'], 'quota_error')

    async def test_outside_fleet_coverage(self):
        result = await DispatchAgent().process({'resource_requirements': [{'type': 'ambulance', 'quantity': 1}],
            'location': {'latitude': 18.52, 'longitude': 73.85}, 'incident_id': 'pune', 'priority': 'P1', 'agent_trail': []})
        self.assertEqual(result['dispatch_status'], 'outside_service_area')
        self.assertEqual(result['assigned_resources'], [])
        self.assertEqual(find_nearest_available('ambulance', 18.52, 73.85), [])
        self.assertTrue(find_nearest_available('ambulance', 12.975, 77.606))
