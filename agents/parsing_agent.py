import json
import re
import random
from datetime import datetime
from typing import List, Tuple

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field


class IndianGeocoder:
    """Accurate geocoding for Indian emergency locations"""
    
    # Comprehensive Indian location database
    LOCATIONS = {
        # Delhi NCR Core
        "delhi": (28.6139, 77.2090),
        "new delhi": (28.6139, 77.2090),
        "connaught place": (28.6289, 77.2065),
        "cp": (28.6289, 77.2065),
        
        # Gurugram/Gurgaon Sectors
        "sector 14": (28.4684, 77.0294),
        "sector 14 gurugram": (28.4684, 77.0294),
        "sector 14 gurgaon": (28.4684, 77.0294),
        "sector 18": (28.4942, 77.0816),
        "sector 22": (28.4931, 77.0890),
        "sector 29": (28.4620, 77.0670),
        "sector 32": (28.4574, 77.0803),
        "sector 43": (28.4491, 77.0746),
        "sector 56": (28.4247, 77.0932),
        "gurugram": (28.4595, 77.0266),
        "gurgaon": (28.4595, 77.0266),
        
        # Noida Sectors
        "sector 18 noida": (28.5685, 77.3251),
        "sector 62 noida": (28.6254, 77.3646),
        "noida": (28.5355, 77.3910),
        "greater noida": (28.4744, 77.5040),
        
        # Major Landmarks
        "dlf mall": (28.4950, 77.0830),
        "ambience mall": (28.5016, 77.0863),
        "cyber hub": (28.4945, 77.0894),
        "kingdom of dreams": (28.4673, 77.0699),
        "galleria market": (28.4684, 77.0294),
        
        # Delhi Areas
        "saket": (28.5244, 77.2066),
        "nehru place": (28.5494, 77.2501),
        "dwarka": (28.5921, 77.0460),
        "rohini": (28.7499, 77.0672),
        "vasant kunj": (28.5177, 77.1559),
        "lajpat nagar": (28.5678, 77.2432),
        
        # Temples & Religious
        "hanuman mandir": (28.6350, 77.2200),
        "iskcon temple": (28.5562, 77.2515),
        "lotus temple": (28.5535, 77.2588),
        "akshardham": (28.6127, 77.2773),
        
        # Hospitals
        "aiims": (28.5672, 77.2100),
        "fortis hospital": (28.4941, 77.0738),
        "max hospital": (28.5016, 77.0880),
        
        # Highways
        "nh 48": (28.4500, 77.0500),
        "nh-48": (28.4500, 77.0500),
        "nh48": (28.4500, 77.0500),
        "nh 8": (28.4500, 77.0500),
        "national highway 48": (28.4500, 77.0500),
        
        # Metro Stations
        "metro station": (28.6139, 77.2090),
        "huda city centre": (28.4595, 77.0727),
        "iffco chowk": (28.4728, 77.0334),
        
        # Markets
        "sadar bazaar": (28.6507, 77.2152),
        "chandni chowk": (28.6507, 77.2304),
        "karol bagh": (28.6519, 77.1909),
    }
    
    @classmethod
    def geocode(cls, location_text: str) -> Tuple[float, float]:
        """
        Convert location text to (latitude, longitude)
        """
        if not location_text or not location_text.strip():
            # Default: Delhi center
            return (28.6139, 77.2090)
        
        location_lower = location_text.lower().strip()
        
        # Clean common prefixes
        for prefix in ["near ", "ke paas ", "at ", "in ", "mein ", "par "]:
            location_lower = location_lower.replace(prefix, "")
        
        location_lower = location_lower.strip()
        
        # Try exact match
        if location_lower in cls.LOCATIONS:
            lat, lon = cls.LOCATIONS[location_lower]
            # Add tiny random offset to avoid exact overlaps
            lat += random.uniform(-0.0005, 0.0005)
            lon += random.uniform(-0.0005, 0.0005)
            return (lat, lon)
        
        # Try partial match
        for key, coords in cls.LOCATIONS.items():
            if key in location_lower or location_lower in key:
                lat, lon = coords
                lat += random.uniform(-0.0005, 0.0005)
                lon += random.uniform(-0.0005, 0.0005)
                return (lat, lon)
        
        # Extract sector number
        sector_match = re.search(r'sector\s*(\d+)', location_lower)
        if sector_match:
            sector_num = int(sector_match.group(1))
            
            # Gurugram sectors (1-100)
            if 1 <= sector_num <= 100:
                base_lat = 28.4600
                base_lon = 77.0300
                
                # Calculate position in grid
                row = (sector_num - 1) // 10
                col = (sector_num - 1) % 10
                
                lat = base_lat + (row * 0.015) + random.uniform(-0.001, 0.001)
                lon = base_lon + (col * 0.012) + random.uniform(-0.001, 0.001)
                
                return (lat, lon)
        
        # Default: Delhi center with offset
        lat = 28.6139 + random.uniform(-0.03, 0.03)
        lon = 77.2090 + random.uniform(-0.03, 0.03)
        return (lat, lon)


class ParsingResult(BaseModel):
    location_text: str = Field(description="The extracted location string, e.g. 'Sector 14'")
    landmark: str = Field(description="Any specific landmark, e.g. 'Ambience Mall'")
    incident_category: str = Field(description="One of: medical, fire, accident, natural_disaster, violence, other")
    incident_subcategory: str = Field(description="More specific subcategory, e.g. 'cardiac_emergency', 'road_accident'")
    victim_count: int = Field(description="Estimated number of victims")
    severity_indicators: List[str] = Field(description="List of severe indicators like 'unconscious', 'trapped'")
    urgency_level: str = Field(description="One of: immediate, urgent, routine")


class ParsingAgent(BaseAgent):
    """Structured emergency parsing with strong Hindi/Hinglish heuristics."""
    
    NUMBER_WORDS = {
        "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5,
        "cheh": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    }
    
    CRITICAL_TERMS = {
        "unconscious", "behosh", "not breathing", "saans nahi",
        "cardiac arrest", "heart attack", "bleeding", "khoon",
        "trapped", "phas", "faase", "flood", "blast", "cylinder",
        "explosion", "burn", "jal gaye", "labor pain", "water broke",
        "danga", "chaku", "gun",
    }
    
    CATEGORY_PATTERNS = {
        "fire": [
            r"\baag\b", r"\bfire\b", r"\bsmoke\b", r"\bburning\b",
            r"\bcylinder\s*blast\b", r"\bexplosion\b", r"\bblast\b",
        ],
        "medical": [
            r"\bheart\s*attack\b", r"\bcardiac\b", r"\bunconscious\b",
            r"\bbehosh\b", r"\bbleeding\b", r"\bkhoon\b",
            r"\bnot\s*breathing\b", r"\bsaans\s*nahi\b", r"\bambulance\b",
        ],
        "accident": [
            r"\baccident\b", r"\bcrash\b", r"\bcollision\b",
            r"\btakra\b", r"\bvehicle\b", r"\bhighway\b",
        ],
        "natural_disaster": [
            r"\bflood\b", r"\bpaani\s*ghus\s*gaya\b",
            r"\bearthquake\b", r"\blandslide\b",
        ],
        "violence": [
            r"\bdanga\b", r"\briot\b", r"\battack\b",
            r"\bknife\b", r"\bchaku\b", r"\bgun\b",
        ],
    }
    
    LOCATION_PATTERNS = [
        r"\b(sector\s+\d+[a-z]?(?:\s+[a-z]+)?)\b",
        r"\b(nh\s*\d+)\b",
        r"\b(national highway\s*\d+)\b",
        r"\b([a-z0-9\s]+ (?:mall|mandir|hospital|hub|market|chowk|station|place|road|street|nagar|kunj|vihar))\b",
    ]
    
    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ParsingResult)
    
    def extract_location(self, text: str) -> Tuple[str, str]:
        """Extract location and landmark"""
        lowered = text.lower()
        
        for pattern in self.LOCATION_PATTERNS:
            match = re.search(pattern, lowered, flags=re.IGNORECASE)
            if match:
                location = re.sub(r"\s+", " ", match.group(1)).strip()
                landmark = location if any(token in location.lower() for token in ["mall", "mandir", "hospital", "hub", "market", "chowk", "station", "place"]) else ""
                return location.title(), landmark.title()
        
        return "", ""
    
    def classify_incident(self, text: str) -> Tuple[str, str]:
        """Classify incident type"""
        lowered = text.lower()
        
        # Normalize Hindi
        lowered = lowered.replace("aag", "fire").replace("behosh", "unconscious")
        
        scores = {}
        for category, patterns in self.CATEGORY_PATTERNS.items():
            scores[category] = sum(1 for pattern in patterns if re.search(pattern, lowered))
        
        best_category = max(scores, key=scores.get) if scores else "other"
        if scores.get(best_category, 0) == 0:
            return "other", ""
        
        # Determine subcategory
        subcategory = ""
        if "heart attack" in lowered or "cardiac" in lowered:
            subcategory = "cardiac_emergency"
        elif "blast" in lowered or "cylinder" in lowered:
            subcategory = "cylinder_blast"
        elif "flood" in lowered:
            subcategory = "flood"
        elif "accident" in lowered:
            subcategory = "road_accident"
        
        return best_category, subcategory
    
    def extract_victim_count(self, text: str) -> int:
        """Extract number of victims"""
        lowered = text.lower()
        
        # Look for digit + person marker
        match = re.search(r'(\d+)\s*(?:log|people|person)', lowered)
        if match:
            return int(match.group(1))
        
        # Look for word + person marker
        for word, num in self.NUMBER_WORDS.items():
            if re.search(rf'\b{word}\s+(?:log|people)', lowered):
                return num
        
        return 1
    
    def extract_severity_indicators(self, text: str) -> List[str]:
        """Extract severity clues"""
        lowered = text.lower()
        indicators = []
        
        for term in self.CRITICAL_TERMS:
            if term in lowered:
                indicators.append(term)
        
        return indicators
    
    def heuristic_parse(self, text: str) -> dict:
        """Fallback heuristic parsing"""
        location_text, landmark = self.extract_location(text)
        category, subcategory = self.classify_incident(text)
        severity_indicators = self.extract_severity_indicators(text)
        victim_count = self.extract_victim_count(text)
        urgency = "immediate" if severity_indicators else "urgent"
        
        return {
            "location_text": location_text,
            "landmark": landmark,
            "incident_category": category,
            "incident_subcategory": subcategory,
            "victim_count": victim_count,
            "severity_indicators": severity_indicators,
            "urgency_level": urgency,
        }
    
    def generate_follow_up(self, missing_fields: List[str]) -> str:
        """Generate a contextual follow-up question when critical info is missing."""
        if "location" in missing_fields:
            return "What is the nearest landmark, major road, or sector number near you?"
        return "Could you provide more details about the situation?"

    async def process(self, state: dict) -> dict:
        """Main processing"""
        text = state["normalized_text"]
        
        # Try LLM if available
        parsed_data = None
        if self.llm_available:
            try:
                prompt = f"""Extract emergency information from: "{text}"

Return JSON with:
- location_text (string)
- landmark (string)
- incident_category (medical/fire/accident/natural_disaster/violence/other)
- incident_subcategory (string)
- victim_count (integer)
- severity_indicators (list of strings)
- urgency_level (immediate/urgent/routine)
"""
                response = await self.invoke_llm([HumanMessage(content=prompt)])
                parsed_data = self.parser.parse(response.content)
            except Exception as exc:
                state["errors"].append(f"LLM parsing failed: {exc}")
        
        # Fallback to heuristics
        if not parsed_data:
            parsed_data = self.heuristic_parse(text)
        
        # Geocode location
        location_text = parsed_data.get("location_text", "")
        lat, lon = IndianGeocoder.geocode(location_text)
        
        location = {
            "raw_text": location_text,
            "landmark": parsed_data.get("landmark", ""),
            "latitude": lat,
            "longitude": lon,
            "confidence": 0.88 if location_text else 0.3,
        }
        
        incident_type = {
            "category": parsed_data.get("incident_category", "other"),
            "subcategory": parsed_data.get("incident_subcategory", ""),
            "confidence": 0.9 if parsed_data.get("incident_category") != "other" else 0.35,
        }
        
        distress_score = min(len(parsed_data.get("severity_indicators", [])) * 0.2 + 0.3, 1.0)
        
        # Callback logic
        requires_callback = False
        missing_fields = []
        suggested_question = None
        
        if not location_text:
            requires_callback = True
            missing_fields.append("location")
            suggested_question = self.generate_follow_up(missing_fields)
        
        state["agent_trail"].append({
            "agent": "parsing",
            "timestamp": datetime.now(),
            "decision": f"Extracted {incident_type['category']}",
            "reasoning": f"Location={location['raw_text'] or 'unknown'}, Victims={parsed_data.get('victim_count', 1)}",
        })
        
        return {
            **state,
            "location": location,
            "incident_type": incident_type,
            "victim_count": parsed_data.get("victim_count", 1),
            "severity_clues": parsed_data.get("severity_indicators", []),
            "distress_score": distress_score,
            "requires_callback": requires_callback,
            "missing_fields": missing_fields,
            "suggested_callback_script": suggested_question,
        }