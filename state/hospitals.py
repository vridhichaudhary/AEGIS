import math

HOSPITALS = [
    {"id": "aiims", "name": "AIIMS Trauma Centre", "lat": 28.5665, "lng": 77.2100, "trauma_beds": 12, "available": 8, "specialties": ["trauma", "cardiac", "burn"]},
    {"id": "safdarjung", "name": "Safdarjung Hospital", "lat": 28.5688, "lng": 77.2061, "trauma_beds": 8, "available": 3, "specialties": ["trauma", "ortho"]},
    {"id": "gtb", "name": "GTB Hospital", "lat": 28.6876, "lng": 77.3048, "trauma_beds": 10, "available": 7, "specialties": ["trauma", "burn"]},
    {"id": "lnjp", "name": "LNJP Hospital", "lat": 28.6415, "lng": 77.2319, "trauma_beds": 6, "available": 1, "specialties": ["trauma", "cardiac"]},
]

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)
