import json
import re
from datetime import datetime

from agents.base_agent import BaseAgent

from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List

import random

class IndianGeocoder:
    """Accurate geocoding for Indian locations"""
    
    # Major Indian city coordinates
    LOCATIONS = {
        # Delhi NCR
        "delhi": (28.6139, 77.2090),
        "connaught place": (28.6289, 77.2065),
        "cp": (28.6289, 77.2065),
        "new delhi": (28.6139, 77.2090),
        
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
        
        # Noida Sectors
        "sector 18 noida": (28.5685, 77.3251),
        "sector 62 noida": (28.6254, 77.3646),
        "noida": (28.5355, 77.3910),
        
        # Major landmarks
        "dlf mall": (28.4950, 77.0830),
        "ambience mall": (28.5016, 77.0863),
        "cyber hub": (28.4945, 77.0894),
        "kingdom of dreams": (28.4673, 77.0699),
        "galleria market": (28.4684, 77.0294),
        "saket": (28.5244, 77.2066),
        "nehru place": (28.5494, 77.2501),
        
        # Temples & religious places
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
        
        # Metro stations
        "metro station": (28.6139, 77.2090),
        "huda city centre": (28.4595, 77.0727),
        "iffco chowk": (28.4728, 77.0334),
        
        # Markets
        "sadar bazaar": (28.6507, 77.2152),
        "chandni chowk": (28.6507, 77.2304),
        "karol bagh": (28.6519, 77.1909),
    }
    
    @classmethod
    def geocode(cls, location_text: str) -> tuple[float, float]:
        """
        Convert location text to (latitude, longitude)
        Returns Delhi center + offset if location not found
        """
        if not location_text or location_text.strip() == "":
            # Default: Delhi center
            return (28.6139, 77.2090)
        
        location_lower = location_text.lower().strip()
        
        # Clean common prefixes
        location_lower = location_lower.replace("near ", "")
        location_lower = location_lower.replace("ke paas ", "")
        location_lower = location_lower.replace("at ", "")
        location_lower = location_lower.replace("in ", "")
        
        # Try exact match first
        if location_lower in cls.LOCATIONS:
            lat, lon = cls.LOCATIONS[location_lower]
            # Add tiny random offset to avoid exact overlaps
            lat += random.uniform(-0.001, 0.001)
            lon += random.uniform(-0.001, 0.001)
            return (lat, lon)
        
        # Try partial match
        for key, coords in cls.LOCATIONS.items():
            if key in location_lower or location_lower in key:
                lat, lon = coords
                lat += random.uniform(-0.001, 0.001)
                lon += random.uniform(-0.001, 0.001)
                return (lat, lon)
        
        # Extract sector number if present
        import re
        sector_match = re.search(r'sector\s*(\d+)', location_lower)
        if sector_match:
            sector_num = int(sector_match.group(1))
            
            # Gurugram sectors (1-100)
            if sector_num <= 100:
                base_lat = 28.4600
                base_lon = 77.0300
                
                # Calculate position in grid
                row = (sector_num - 1) // 10
                col = (sector_num - 1) % 10
                
                lat = base_lat + (row * 0.015) + random.uniform(-0.002, 0.002)
                lon = base_lon + (col * 0.012) + random.uniform(-0.002, 0.002)
                
                return (lat, lon)
        
        # Default: Delhi center with random offset
        lat = 28.6139 + random.uniform(-0.05, 0.05)
        lon = 77.2090 + random.uniform(-0.05, 0.05)
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
        "zero": 0,
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
        "ek": 1,
        "do": 2,
        "teen": 3,
        "char": 4,
        "chaar": 4,
        "paanch": 5,
        "cheh": 6,
        "saat": 7,
        "aath": 8,
        "nau": 9,
        "das": 10,
    }

    PERSON_MARKERS = [
        "log",
        "people",
        "person",
        "persons",
        "aadmi",
        "admi",
        "children",
        "child",
        "bachche",
        "bache",
        "injured",
        "ghayal",
        "victim",
        "victims",
        "gaadi",
        "gadiyan",
        "cars",
        "vehicles",
    ]

    CRITICAL_TERMS = {
        "unconscious",
        "behosh",
        "not breathing",
        "saans nahi",
        "saans nahi aa rahi",
        "cardiac arrest",
        "heart attack",
        "bleeding",
        "khoon",
        "trapped",
        "phas",
        "phase",
        "faase",
        "rescue",
        "flood",
        "blast",
        "cylinder",
        "explosion",
        "burn",
        "jal gaye",
        "labor pain",
        "water broke",
        "paani toot gaya",
        "danga",
        "chaku",
        "gun",
    }

    CATEGORY_PATTERNS = {
        "fire": [
            r"\baag\b",
            r"\bfire\b",
            r"\bsmoke\b",
            r"\bflames?\b",
            r"\bburning\b",
            r"\bcylinder blast\b",
            r"\bexplosion\b",
            r"\bblast\b",
            r"\bjal gaye\b",
            r"\bburn(?:ed|t|ing)?\b",
        ],
        "medical": [
            r"\bheart attack\b",
            r"\bcardiac\b",
            r"\bunconscious\b",
            r"\bbehosh\b",
            r"\bbleeding\b",
            r"\bkhoon\b",
            r"\bnot breathing\b",
            r"\bsaans nahi\b",
            r"\bambulance\b",
            r"\blabor pain\b",
            r"\bpregnan",
            r"\bwater broke\b",
            r"\bpaani toot gaya\b",
            r"\bchest pain\b",
        ],
        "accident": [
            r"\baccident\b",
            r"\bcrash\b",
            r"\bcollision\b",
            r"\btakra\b",
            r"\btakr[ai]\b",
            r"\btruck hit\b",
            r"\bvehicle\b",
            r"\bhighway\b",
            r"\bnh\s*\d+\b",
        ],
        "natural_disaster": [
            r"\bflood\b",
            r"\bpaani gharon mein\b",
            r"\bpaani ghus gaya\b",
            r"\bwater level\b",
            r"\bbuilding collapse\b",
            r"\bearthquake\b",
            r"\blandslide\b",
            r"\bstorm\b",
            r"\brescue team\b",
        ],
        "violence": [
            r"\bdanga\b",
            r"\briot\b",
            r"\bfight\b",
            r"\battack\b",
            r"\bknife\b",
            r"\bchaku\b",
            r"\bgun\b",
            r"\bshoot",
            r"\bpolice\b",
            r"\bcommunal\b",
        ],
    }

    LOCATION_PATTERNS = [
        r"\b(sector\s+\d+[a-z]?(?:\s+[a-z]+)?)\b",
        r"\b(nh\s*\d+)\b",
        r"\b(national highway\s*\d+)\b",
        r"\b([a-z0-9\s]+ mall)\b",
        r"\b([a-z0-9\s]+ mandir)\b",
        r"\b([a-z0-9\s]+ station)\b",
        r"\b([a-z0-9\s]+ hospital)\b",
        r"\b([a-z0-9\s]+ market)\b",
        r"\b([a-z0-9\s]+ chowk)\b",
    ]

    CONTEXT_LOCATION_PATTERNS = [
        r"\b(?:near|paas|ke paas|saamne|ke saamne|par|mein|me|at)\s+([a-z0-9\s]+(?:mall|mandir|station|hospital|market|chowk))\b",
        r"\b(?:near|paas|ke paas|saamne|ke saamne|par|mein|me|at)\s+([a-z0-9\s]+sector\s+\d+[a-z]?(?:\s+[a-z]+)?)\b",
    ]

    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ParsingResult)

    def build_gemini_prompt(self, text: str, language_code: str) -> str:
        format_instructions = self.parser.get_format_instructions()
        return f"""You are an expert emergency call analyst for India's emergency dispatch system.

Your job is to extract critical information from the following emergency call transcript.
Pay close attention to Hinglish/Hindi phrases commonly used in India (e.g., 'aag lag gayi' -> fire, 'chot lagi' -> medical/accident, 'behosh' -> unconscious).

Call Transcript:
"{text}"

Language: {language_code}

Instructions:
1. Extract the location and any specific landmarks. Handle Indian contexts like "Sector X" or "near Y mandir".
2. Categorize the incident strictly into one of the allowed categories.
3. Estimate the victim count. If plurals like 'log' or 'bache' are used without a number, assume at least 2.
4. Extract severe indicators (e.g., 'trapped', 'unconscious', 'bleeding', 'heavy smoke').
5. Assess the urgency level.

{format_instructions}
"""

    def calculate_distress_score(self, text: str) -> float:
        lowered = text.lower()
        score = 0.0
        if "!" in text or "?" in text:
            score += 0.1
        score += min(text.count("...") * 0.05, 0.15)
        panic_terms = [
            "help",
            "jaldi",
            "bachao",
            "urgent",
            "emergency",
            "turant",
            "please",
            "save",
            "madad",
            "abhi",
        ]
        score += min(sum(0.08 for term in panic_terms if term in lowered), 0.4)
        if any(term in lowered for term in self.CRITICAL_TERMS):
            score += 0.25
        return min(score, 1.0)

    def normalize_for_rules(self, text: str) -> str:
        lowered = text.lower()
        replacements = {
            "phas gaye": "trapped",
            "phase hain": "trapped",
            "faase hue": "trapped",
            "behosh": "unconscious",
            "khoon": "bleeding",
            "saans nahi aa rahi": "not breathing",
            "saans nahi": "not breathing",
            "paani toot gaya": "water broke",
            "danga": "riot",
            "chaku": "knife",
            "aag": "fire",
        }
        for source, target in replacements.items():
            lowered = lowered.replace(source, target)
        return lowered

    def extract_location(self, text: str) -> tuple[str, str]:
        lowered = text.lower()

        for pattern in self.CONTEXT_LOCATION_PATTERNS:
            match = re.search(pattern, lowered, flags=re.IGNORECASE)
            if match:
                location = re.sub(r"\s+", " ", match.group(1)).strip()
                return location.title(), location.title() if any(
                    token in location for token in ["mall", "mandir", "station", "hospital", "market", "chowk"]
                ) else ""

        for pattern in self.LOCATION_PATTERNS:
            match = re.search(pattern, lowered, flags=re.IGNORECASE)
            if match:
                location = re.sub(r"\s+", " ", match.group(1)).strip()
                location = re.sub(r"\b(ke|ki|ka|mein|me|par|paas|saamne)$", "", location).strip()
                if location.startswith("sector "):
                    sector_match = re.match(
                        r"(sector\s+\d+[a-z]?)(?:\s+(?!ke\b|ki\b|ka\b|mein\b|me\b|par\b|paas\b|saamne\b)([a-z]+))?",
                        location,
                    )
                    if sector_match:
                        location = " ".join(part for part in sector_match.groups() if part)
                landmark = location if any(
                    token in location for token in ["mall", "mandir", "station", "hospital", "market", "chowk"]
                ) else ""
                return location.title(), landmark.title() if landmark else ""

        return "", ""

    def classify_incident(self, text: str) -> tuple[str, str]:
        lowered = self.normalize_for_rules(text)
        scores = {}
        for category, patterns in self.CATEGORY_PATTERNS.items():
            scores[category] = sum(1 for pattern in patterns if re.search(pattern, lowered))

        best_category = max(scores, key=scores.get)
        if scores[best_category] == 0:
            return "other", ""

        subcategory = ""
        if "heart attack" in lowered or "cardiac" in lowered:
            subcategory = "cardiac_emergency"
        elif "labor pain" in lowered or "water broke" in lowered:
            subcategory = "obstetric_emergency"
        elif "cylinder" in lowered or "blast" in lowered:
            subcategory = "cylinder_blast"
        elif "flood" in lowered or "water level" in lowered:
            subcategory = "flood"
        elif "knife" in lowered or "riot" in lowered:
            subcategory = "armed_violence"
        elif "accident" in lowered or "crash" in lowered:
            subcategory = "road_accident"

        return best_category, subcategory

    def extract_victim_count(self, text: str) -> int:
        lowered = text.lower()

        contextual_digit_patterns = [
            r"\b(\d+)\s*(?:log|people|persons|aadmi|admi|children|child|victims?|injured|ghayal|cars|vehicles|gaadi|gadiyan)\b",
            r"\b(\d+)\s*(?:gaadi|gadiyan|cars|vehicles)\b",
        ]
        for pattern in contextual_digit_patterns:
            match = re.search(pattern, lowered)
            if match:
                return int(match.group(1))

        contextual_word_patterns = [
            r"\b(" + "|".join(self.NUMBER_WORDS.keys()) + r")\s+(?:log|people|persons|aadmi|admi|children|child|victims?|injured|ghayal|gaadi|gadiyan|cars|vehicles)\b",
        ]
        for pattern in contextual_word_patterns:
            match = re.search(pattern, lowered)
            if match:
                return self.NUMBER_WORDS[match.group(1)]

        if re.search(r"\b(?:children|child|bachche|bache)\b", lowered):
            return 2
        return 1

    def extract_severity_indicators(self, text: str) -> list[str]:
        lowered = self.normalize_for_rules(text)
        indicators = []
        for term in sorted(self.CRITICAL_TERMS):
            if term in lowered:
                indicators.append(term)
        if "third floor" in lowered or "teesri manzil" in lowered:
            indicators.append("upper_floor_entrapment")
        if "smoke" in lowered:
            indicators.append("heavy_smoke")
        return indicators

    def heuristic_parse(self, text: str) -> dict:
        location_text, landmark = self.extract_location(text)
        category, subcategory = self.classify_incident(text)
        severity_indicators = self.extract_severity_indicators(text)
        victim_count = self.extract_victim_count(text)
        urgency = "immediate" if severity_indicators else "urgent" if "urgent" in text.lower() else "routine"

        return {
            "location_text": location_text,
            "landmark": landmark,
            "incident_category": category,
            "incident_subcategory": subcategory,
            "victim_count": victim_count,
            "severity_indicators": severity_indicators,
            "urgency_level": urgency,
        }

    def generate_follow_up(self, missing_fields: list[str]) -> str:
        """Generate a contextual follow-up question when critical info is missing."""
        if "location" in missing_fields:
            return "What is the nearest landmark, major road, or sector number near you?"
        return "Could you provide more details about the situation?"


    async def process(self, state: dict) -> dict:
        text = state["normalized_text"]
        lang_code = state["language_code"]
        parsed_data = None

        if self.llm_available and HumanMessage is not None:
            try:
                response = await self.invoke_llm([HumanMessage(content=self.build_gemini_prompt(text, lang_code))])
                parsed_data = self.parser.parse(response.content)
            except Exception as exc:
                state["errors"].append(f"Parsing LLM fallback triggered: {exc}")

        if parsed_data is None:
            parsed_data = self.heuristic_parse(text)

        distress_score = self.calculate_distress_score(text)
        # Geocode the location
        location_text = parsed_data.get("location_text", "")
        lat, lon = IndianGeocoder.geocode(location_text)

        confidence = 0.88 if location_text else 0.3
        
        requires_callback = state.get("requires_callback", False)
        missing_fields = state.get("missing_fields", [])
        suggested_question = state.get("suggested_callback_script", None)
        
        if not location_text or confidence < 0.5:
            location_text = "Unknown"
            requires_callback = True
            if "location" not in missing_fields:
                missing_fields.append("location")
            suggested_question = self.generate_follow_up(missing_fields)

        location = {
            "raw_text": location_text,
            "landmark": parsed_data.get("landmark", ""),
            "latitude": lat,
            "longitude": lon,
            "confidence": confidence,
        }
        incident_type = {
            "category": parsed_data.get("incident_category", "other"),
            "subcategory": parsed_data.get("incident_subcategory", ""),
            "confidence": 0.9 if parsed_data.get("incident_category") != "other" else 0.35,
        }

        state["agent_trail"].append(
            {
                "agent": "parsing",
                "timestamp": datetime.now(),
                "decision": f"Extracted {incident_type['category']} / {incident_type['subcategory'] or 'general'}",
                "reasoning": (
                    f"Location={location['raw_text'] or 'unknown'}, "
                    f"Victims={parsed_data.get('victim_count', 1)}, "
                    f"Severity={', '.join(parsed_data.get('severity_indicators', [])) or 'none'}"
                ),
            }
        )

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
