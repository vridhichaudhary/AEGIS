"""
Delhi NCR Emergency Resource Dataset
25 locations: hospitals, police stations, fire stations
Real-world approximate coordinates across Delhi + Gurgaon + Noida
"""
import math

# ── Haversine Distance ─────────────────────────────────────────────────────────
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

# ── Speed constants (km/h) ────────────────────────────────────────────────────
SPEED = {
    "ambulance": 40,
    "ambulance_cardiac": 40,
    "ambulance_trauma": 40,
    "fire_truck": 35,
    "fire_truck_rescue": 35,
    "police": 45,
    "rescue_team": 30,
}

def compute_eta(dist_km: float, resource_type: str) -> float:
    """ETA in minutes using real distance and resource-type speed."""
    speed = SPEED.get(resource_type, 40)
    return round((dist_km / speed) * 60, 1)

# ── Hospitals (legacy key kept for backward compat) ────────────────────────────
HOSPITALS = [
    {"id": "aiims",       "name": "AIIMS Trauma Centre",       "lat": 28.5665, "lng": 77.2100, "trauma_beds": 12, "available": 8,  "specialties": ["trauma", "cardiac", "burn"]},
    {"id": "safdarjung",  "name": "Safdarjung Hospital",        "lat": 28.5688, "lng": 77.2061, "trauma_beds": 8,  "available": 3,  "specialties": ["trauma", "ortho"]},
    {"id": "gtb",         "name": "GTB Hospital",               "lat": 28.6876, "lng": 77.3048, "trauma_beds": 10, "available": 7,  "specialties": ["trauma", "burn"]},
    {"id": "lnjp",        "name": "LNJP Hospital",              "lat": 28.6415, "lng": 77.2319, "trauma_beds": 6,  "available": 1,  "specialties": ["trauma", "cardiac"]},
    {"id": "fortis_gurg", "name": "Fortis Memorial Gurgaon",   "lat": 28.4595, "lng": 77.0266, "trauma_beds": 15, "available": 9,  "specialties": ["cardiac", "trauma", "burn"]},
    {"id": "max_noida",   "name": "Max Hospital Noida",         "lat": 28.5706, "lng": 77.3219, "trauma_beds": 10, "available": 5,  "specialties": ["trauma", "cardiac"]},
    {"id": "apollo_delhi","name": "Apollo Hospital Delhi",      "lat": 28.5562, "lng": 77.2825, "trauma_beds": 14, "available": 6,  "specialties": ["cardiac", "trauma", "burn"]},
    {"id": "rml",         "name": "RML Hospital",               "lat": 28.6358, "lng": 77.1997, "trauma_beds": 8,  "available": 4,  "specialties": ["trauma", "ortho"]},
]

# ── Full Smart City Resource Depots ───────────────────────────────────────────
RESOURCE_DEPOTS = [
    # ── Ambulance Bases ───────────────────────────────────────────────────────
    {
        "id": "amb_aiims",
        "name": "AIIMS Ambulance Base",
        "type": "ambulance",
        "lat": 28.5665, "lng": 77.2100,
        "resources": {"ambulances": 4, "fire_trucks": 0, "police_units": 0},
        "available": {"ambulances": 4, "fire_trucks": 0, "police_units": 0},
        "units": [
            {"resource_id": "AMB-101", "resource_type": "ambulance",        "status": "available"},
            {"resource_id": "AMB-102", "resource_type": "ambulance",        "status": "available"},
            {"resource_id": "CARD-201","resource_type": "ambulance_cardiac", "status": "available"},
            {"resource_id": "TRM-301", "resource_type": "ambulance_trauma",  "status": "available"},
        ]
    },
    {
        "id": "amb_safdarjung",
        "name": "Safdarjung Emergency Base",
        "type": "ambulance",
        "lat": 28.5688, "lng": 77.2061,
        "resources": {"ambulances": 3, "fire_trucks": 0, "police_units": 0},
        "available": {"ambulances": 3, "fire_trucks": 0, "police_units": 0},
        "units": [
            {"resource_id": "AMB-103", "resource_type": "ambulance", "status": "available"},
            {"resource_id": "AMB-104", "resource_type": "ambulance", "status": "available"},
            {"resource_id": "TRM-302", "resource_type": "ambulance_trauma", "status": "available"},
        ]
    },
    {
        "id": "amb_gtb",
        "name": "GTB Hospital Ambulance Hub",
        "type": "ambulance",
        "lat": 28.6876, "lng": 77.3048,
        "resources": {"ambulances": 2, "fire_trucks": 0, "police_units": 0},
        "available": {"ambulances": 2, "fire_trucks": 0, "police_units": 0},
        "units": [
            {"resource_id": "AMB-105", "resource_type": "ambulance", "status": "available"},
            {"resource_id": "CARD-202", "resource_type": "ambulance_cardiac", "status": "available"},
        ]
    },
    {
        "id": "amb_gurgaon",
        "name": "Gurgaon EMS Base",
        "type": "ambulance",
        "lat": 28.4595, "lng": 77.0266,
        "resources": {"ambulances": 3, "fire_trucks": 0, "police_units": 0},
        "available": {"ambulances": 3, "fire_trucks": 0, "police_units": 0},
        "units": [
            {"resource_id": "AMB-106", "resource_type": "ambulance", "status": "available"},
            {"resource_id": "AMB-107", "resource_type": "ambulance", "status": "available"},
            {"resource_id": "TRM-303", "resource_type": "ambulance_trauma", "status": "available"},
        ]
    },
    {
        "id": "amb_noida",
        "name": "Noida EMS Centre",
        "type": "ambulance",
        "lat": 28.5706, "lng": 77.3219,
        "resources": {"ambulances": 2, "fire_trucks": 0, "police_units": 0},
        "available": {"ambulances": 2, "fire_trucks": 0, "police_units": 0},
        "units": [
            {"resource_id": "AMB-108", "resource_type": "ambulance", "status": "available"},
            {"resource_id": "CARD-203", "resource_type": "ambulance_cardiac", "status": "available"},
        ]
    },

    # ── Fire Stations ─────────────────────────────────────────────────────────
    {
        "id": "fire_connaught",
        "name": "Connaught Place Fire Station",
        "type": "fire",
        "lat": 28.6330, "lng": 77.2195,
        "resources": {"ambulances": 0, "fire_trucks": 3, "police_units": 0},
        "available": {"ambulances": 0, "fire_trucks": 3, "police_units": 0},
        "units": [
            {"resource_id": "FIR-401", "resource_type": "fire_truck",         "status": "available"},
            {"resource_id": "FIR-402", "resource_type": "fire_truck",         "status": "available"},
            {"resource_id": "FIR-451", "resource_type": "fire_truck_rescue",  "status": "available"},
        ]
    },
    {
        "id": "fire_rohini",
        "name": "Rohini Fire Station",
        "type": "fire",
        "lat": 28.7041, "lng": 77.1025,
        "resources": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "available": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "units": [
            {"resource_id": "FIR-403", "resource_type": "fire_truck",        "status": "available"},
            {"resource_id": "FIR-452", "resource_type": "fire_truck_rescue", "status": "available"},
        ]
    },
    {
        "id": "fire_lajpatnagar",
        "name": "Lajpat Nagar Fire Station",
        "type": "fire",
        "lat": 28.5700, "lng": 77.2414,
        "resources": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "available": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "units": [
            {"resource_id": "FIR-404", "resource_type": "fire_truck", "status": "available"},
            {"resource_id": "FIR-405", "resource_type": "fire_truck", "status": "available"},
        ]
    },
    {
        "id": "fire_gurgaon",
        "name": "Gurgaon Sector 14 Fire Station",
        "type": "fire",
        "lat": 28.4740, "lng": 77.0266,
        "resources": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "available": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "units": [
            {"resource_id": "FIR-406", "resource_type": "fire_truck",         "status": "available"},
            {"resource_id": "FIR-453", "resource_type": "fire_truck_rescue",  "status": "available"},
        ]
    },
    {
        "id": "fire_noida",
        "name": "Noida Sector 58 Fire Station",
        "type": "fire",
        "lat": 28.6284, "lng": 77.3649,
        "resources": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "available": {"ambulances": 0, "fire_trucks": 2, "police_units": 0},
        "units": [
            {"resource_id": "FIR-407", "resource_type": "fire_truck", "status": "available"},
            {"resource_id": "FIR-408", "resource_type": "fire_truck", "status": "available"},
        ]
    },

    # ── Police Stations ───────────────────────────────────────────────────────
    {
        "id": "police_hq",
        "name": "Delhi Police HQ (ITO)",
        "type": "police",
        "lat": 28.6139, "lng": 77.2090,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 4},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 4},
        "units": [
            {"resource_id": "POL-501", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-502", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-503", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-504", "resource_type": "police", "status": "available"},
        ]
    },
    {
        "id": "police_rohini",
        "name": "Rohini Police Station",
        "type": "police",
        "lat": 28.7070, "lng": 77.1045,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "units": [
            {"resource_id": "POL-505", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-506", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-507", "resource_type": "police", "status": "available"},
        ]
    },
    {
        "id": "police_lajpatnagar",
        "name": "Lajpat Nagar Police Station",
        "type": "police",
        "lat": 28.5665, "lng": 77.2437,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "units": [
            {"resource_id": "POL-508", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-509", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-510", "resource_type": "police", "status": "available"},
        ]
    },
    {
        "id": "police_gurgaon",
        "name": "Gurgaon Sadar Police Station",
        "type": "police",
        "lat": 28.4595, "lng": 77.0300,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "units": [
            {"resource_id": "POL-511", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-512", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-513", "resource_type": "police", "status": "available"},
        ]
    },
    {
        "id": "police_noida",
        "name": "Noida Sector 20 Police Station",
        "type": "police",
        "lat": 28.5706, "lng": 77.3100,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 3},
        "units": [
            {"resource_id": "POL-514", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-515", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-516", "resource_type": "police", "status": "available"},
        ]
    },
    {
        "id": "police_janakpuri",
        "name": "Janakpuri Police Station",
        "type": "police",
        "lat": 28.6219, "lng": 77.0840,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 2},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 2},
        "units": [
            {"resource_id": "POL-517", "resource_type": "police", "status": "available"},
            {"resource_id": "POL-518", "resource_type": "police", "status": "available"},
        ]
    },

    # ── NDRF / Rescue ─────────────────────────────────────────────────────────
    {
        "id": "ndrf_base",
        "name": "NDRF Base Camp",
        "type": "rescue",
        "lat": 28.5672, "lng": 77.3210,
        "resources": {"ambulances": 0, "fire_trucks": 0, "police_units": 0},
        "available": {"ambulances": 0, "fire_trucks": 0, "police_units": 0},
        "units": [
            {"resource_id": "RSC-601", "resource_type": "rescue_team", "status": "available"},
            {"resource_id": "RSC-602", "resource_type": "rescue_team", "status": "available"},
        ]
    },
]

# ── In-memory availability tracking ──────────────────────────────────────────
_unit_assignments: dict = {}   # resource_id -> {incident_id, priority, status}

def get_all_units() -> list:
    """Flat list of all units across all depots."""
    units = []
    for depot in RESOURCE_DEPOTS:
        for unit in depot["units"]:
            units.append({**unit, "depot_id": depot["id"], "depot_name": depot["name"],
                          "depot_lat": depot["lat"], "depot_lng": depot["lng"]})
    return units

def find_nearest_available(resource_type: str, dest_lat: float, dest_lng: float) -> list:
    """
    Return list of available units of given type sorted by distance (nearest first).
    Each item includes computed distance_km and eta_minutes.
    """
    candidates = []
    for unit in get_all_units():
        if unit["resource_type"] != resource_type:
            continue
        assignment = _unit_assignments.get(unit["resource_id"])
        if assignment and assignment.get("status") != "available":
            continue
        dist = haversine_distance(unit["depot_lat"], unit["depot_lng"], dest_lat, dest_lng)
        eta = compute_eta(dist, resource_type)
        candidates.append({**unit, "distance_km": round(dist, 2), "eta_minutes": round(eta, 1)})
    candidates.sort(key=lambda x: x["distance_km"])
    return candidates

def assign_unit(resource_id: str, incident_id: str, priority: str):
    _unit_assignments[resource_id] = {"incident_id": incident_id, "priority": priority, "status": "dispatched"}

def release_units(incident_id: str) -> list:
    released = []
    for rid, assignment in list(_unit_assignments.items()):
        if assignment.get("incident_id") == incident_id:
            del _unit_assignments[rid]
            released.append(rid)
    return released

def get_fleet_status() -> list:
    """Return all units with current status for frontend fleet view."""
    result = []
    for depot in RESOURCE_DEPOTS:
        for unit in depot["units"]:
            assignment = _unit_assignments.get(unit["resource_id"])
            status = assignment["status"] if assignment else "available"
            result.append({
                "id": unit["resource_id"],
                "name": unit["resource_id"],
                "type": unit["resource_type"],
                "status": status,
                "depot": depot["name"],
                "lat": depot["lat"],
                "lng": depot["lng"],
            })
    return result
