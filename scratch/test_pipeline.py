import asyncio
import json
from agents.supervisor import SupervisorAgent

async def test_full_pipeline():
    supervisor = SupervisorAgent()
    
    scenarios = [
        "Fire in Sector 14 market, 3 people trapped in building!",
        "Accident near Cyber Hub, car hit a pole, driver is unconscious.",
        "Mera accident ho gaya hai NH8 par, jaldi ambulance bhejo!",
        "I need help but I don't know where I am, something is burning."
    ]
    
    for text in scenarios:
        print(f"\n--- Testing Transcript: '{text}' ---")
        result = await supervisor.run(text)
        
        print(f"Incident ID: {result.get('incident_id')}")
        print(f"Location: {result.get('location', {}).get('raw_text')} ({result.get('location', {}).get('latitude')}, {result.get('location', {}).get('longitude')})")
        print(f"Type: {result.get('incident_type', {}).get('category')}")
        print(f"Priority: {result.get('priority')}")
        print(f"Requires Callback: {result.get('requires_callback')}")
        print(f"Dispatch Status: {result.get('dispatch_status')}")
        print(f"Assigned Resources: {[r['resource_type'] for r in result.get('assigned_resources', [])]}")
        
        if result.get('requires_callback'):
            print(f"Suggested Question: {result.get('suggested_callback_script')}")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
