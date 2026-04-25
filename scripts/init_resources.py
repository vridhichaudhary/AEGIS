import redis
import json
from config.settings import settings

def initialize_mock_resources():
    """Populate Redis with mock emergency resources with proper coordinates"""
    
    try:
        client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        client.ping()
        print("✅ Connected to Redis")
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        print("⚠️  Make sure Redis is running: docker-compose up -d redis")
        return
    
    # Gurugram/Delhi area ambulances
    ambulances = [
        {
            "resource_id": "AMB-001",
            "type": "ambulance",
            "status": "available",
            "location": {"latitude": 28.4595, "longitude": 77.0727},
            "base": "Huda City Centre"
        },
        {
            "resource_id": "AMB-002",
            "type": "ambulance",
            "status": "available",
            "location": {"latitude": 28.4941, "longitude": 77.0738},
            "base": "Fortis Hospital Gurugram"
        },
        {
            "resource_id": "AMB-003",
            "type": "ambulance_cardiac",
            "status": "available",
            "location": {"latitude": 28.5016, "longitude": 77.0880},
            "base": "Max Hospital Gurugram",
            "capabilities": ["cardiac", "advanced_life_support"]
        },
        {
            "resource_id": "AMB-004",
            "type": "ambulance_trauma",
            "status": "available",
            "location": {"latitude": 28.4684, "longitude": 77.0294},
            "base": "Sector 14 Medical Center",
            "capabilities": ["trauma", "burns"]
        },
    ]
    
    # Fire trucks
    fire_trucks = [
        {
            "resource_id": "FIRE-001",
            "type": "fire_truck",
            "status": "available",
            "location": {"latitude": 28.4728, "longitude": 77.0334},
            "base": "IFFCO Chowk Fire Station"
        },
        {
            "resource_id": "FIRE-002",
            "type": "fire_truck_rescue",
            "status": "available",
            "location": {"latitude": 28.4945, "longitude": 77.0894},
            "base": "Cyber Hub Fire Station",
            "capabilities": ["rescue", "high_rise"]
        },
        {
            "resource_id": "FIRE-003",
            "type": "fire_truck",
            "status": "available",
            "location": {"latitude": 28.5244, "longitude": 77.2066},
            "base": "Saket Fire Station"
        },
    ]
    
    # Police units
    police_units = [
        {
            "resource_id": "POL-001",
            "type": "police",
            "status": "available",
            "location": {"latitude": 28.4684, "longitude": 77.0294},
            "base": "Sector 14 Police Station"
        },
        {
            "resource_id": "POL-002",
            "type": "police",
            "status": "available",
            "location": {"latitude": 28.6139, "longitude": 77.2090},
            "base": "Connaught Place Police Station"
        },
    ]
    
    # Store in Redis
    for amb in ambulances:
        key = f"resource:ambulance:{amb['resource_id']}"
        client.set(key, json.dumps(amb))
    
    for truck in fire_trucks:
        key = f"resource:fire_truck:{truck['resource_id']}"
        client.set(key, json.dumps(truck))
    
    for pol in police_units:
        key = f"resource:police:{pol['resource_id']}"
        client.set(key, json.dumps(pol))
    
    print(f"✅ Initialized {len(ambulances)} ambulances")
    print(f"✅ Initialized {len(fire_trucks)} fire trucks")
    print(f"✅ Initialized {len(police_units)} police units")
    print(f"✅ Total resources: {len(ambulances) + len(fire_trucks) + len(police_units)}")

if __name__ == "__main__":
    initialize_mock_resources()