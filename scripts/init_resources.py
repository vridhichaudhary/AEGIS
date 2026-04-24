import redis
import json
from config.settings import settings

def initialize_mock_resources():
    """Populate Redis with mock emergency resources"""
    
    client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True
    )
    
    # Mock ambulances
    ambulances = [
        {"resource_id": "AMB-001", "type": "ambulance", "status": "available", "current_location": {"latitude": 28.6, "longitude": 77.2}},
        {"resource_id": "AMB-002", "type": "ambulance", "status": "available", "current_location": {"latitude": 28.5, "longitude": 77.1}},
        {"resource_id": "AMB-003", "type": "ambulance_cardiac", "status": "available", "current_location": {"latitude": 28.7, "longitude": 77.3}, "capabilities": ["cardiac"]},
    ]
    
    # Mock fire trucks
    fire_trucks = [
        {"resource_id": "FIRE-001", "type": "fire_truck", "status": "available", "current_location": {"latitude": 28.6, "longitude": 77.2}},
        {"resource_id": "FIRE-002", "type": "fire_truck_rescue", "status": "available", "current_location": {"latitude": 28.5, "longitude": 77.1}, "capabilities": ["rescue"]},
    ]
    
    # Store in Redis
    for amb in ambulances:
        key = f"resource:ambulance:{amb['resource_id']}"
        client.set(key, json.dumps(amb))
    
    for truck in fire_trucks:
        key = f"resource:fire_truck:{truck['resource_id']}"
        client.set(key, json.dumps(truck))
    
    print("✅ Initialized mock resources in Redis")
    print(f"  - {len(ambulances)} ambulances")
    print(f"  - {len(fire_trucks)} fire trucks")

if __name__ == "__main__":
    initialize_mock_resources()