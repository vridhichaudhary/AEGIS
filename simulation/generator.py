import random
from typing import List, Dict
from datetime import datetime

class TranscriptGenerator:
    """Generates realistic mock emergency transcripts"""
    
    def __init__(self):
        self.templates = self.load_templates()
    
    def load_templates(self) -> Dict:
        """Template library for different emergency types"""
        return {
            "fire_hindi": [
                "Aag lagi hai bhai! Sector {sector} mein... third floor... log faase hue hain... {victim_count} log... jaldi fire brigade bhejo!",
                "Please help! Building mein aag hai... {landmark} ke paas... smoke bahut zyada hai... bachao please!",
            ],
            "medical_english": [
                "My father is unconscious! {landmark}... he's not breathing properly... please send ambulance urgent!",
                "Heart attack! Sector {sector}... {age} year old male... chest pain... can't breathe... hurry!",
            ],
            "accident_hinglish": [
                "Accident ho gaya hai! {landmark} par... {victim_count} gadiyan crash... bleeding bahut hai... ambulance chahiye!",
                "Car accident near {landmark}... 3-4 people injured... koi behosh ho gaya... please jaldi aao!",
            ],
            "medical_critical": [
                "Please... bachao... cardiac arrest... {landmark}... CPR kar rahe hain... ambulance kahan hai?!",
                "Pregnant woman... labor pain... water broke... {sector}... hospital door hai... emergency!",
            ]
        }
    
    def generate_incident(self, incident_type: str = None, priority: str = None, language: str = "mixed") -> Dict:
        """Generate a single mock incident"""
        
        if not incident_type:
            incident_type = random.choice(["fire", "medical", "accident"])
        
        if not priority:
            priority = random.choice(["P1", "P2", "P3"])
        
        # Select template
        template_key = f"{incident_type}_{language}"
        if template_key not in self.templates:
            template_key = f"{incident_type}_english"
        
        template = random.choice(self.templates.get(template_key, self.templates["medical_english"]))
        
        # Fill template
        transcript = template.format(
            sector=random.randint(1, 100),
            landmark=random.choice([
                "Hanuman Mandir", "DLF Mall", "Metro Station",
                "Sector Market", "Hospital", "School"
            ]),
            victim_count=random.randint(1, 5),
            age=random.randint(25, 75)
        )
        
        return {
            "incident_id": f"SIM-{int(datetime.now().timestamp() * 1000)}",
            "transcript": transcript,
            "true_priority": priority,
            "true_type": incident_type,
            "true_victim_count": random.randint(1, 5),
            "language": language
        }
    
    def generate_batch(self, count: int = 10) -> List[Dict]:
        """Generate multiple incidents"""
        return [self.generate_incident() for _ in range(count)]