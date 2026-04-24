from simulation.generator import TranscriptGenerator
from typing import List, Dict

class SimulationScenarios:
    """Pre-built test scenarios"""
    
    def __init__(self):
        self.generator = TranscriptGenerator()
    
    def normal_load(self) -> List[Dict]:
        """10 calls/min, mixed priorities"""
        return self.generator.generate_batch(10)
    
    def disaster_flood(self) -> List[Dict]:
        """50 calls simulating flood"""
        incidents = []
        for i in range(50):
            incidents.append({
                "transcript": f"Flood in Sector 14! Water level {i % 8 + 1} feet... help needed!",
                "true_priority": "P1" if i < 10 else "P2",
                "true_type": "natural_disaster"
            })
        return incidents
    
    def prank_storm(self) -> List[Dict]:
        """80% false alarms"""
        incidents = []
        
        # 20% real
        for _ in range(20):
            incidents.append(self.generator.generate_incident(priority="P1"))
        
        # 80% prank
        for _ in range(80):
            incidents.append({
                "transcript": "Testing... is this working? Hello?",
                "true_priority": "P5",
                "true_type": "prank"
            })
        
        return incidents