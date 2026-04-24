import json
import re
from datetime import datetime

from agents.base_agent import BaseAgent

try:
    from langchain_core.messages import HumanMessage
except ImportError:  # pragma: no cover
    HumanMessage = None


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

    def build_gemini_prompt(self, text: str, language_code: str) -> str:
        return f"""You are an expert emergency call analyst for India's emergency dispatch system.

Extract location, incident type, victim count, severity indicators, and urgency from this call:
"{text}"

Language: {language_code}

Return ONLY JSON:
{{
  "location_text": "",
  "landmark": "",
  "incident_category": "medical|fire|accident|natural_disaster|violence|other",
  "incident_subcategory": "",
  "victim_count": 1,
  "severity_indicators": [],
  "urgency_level": "immediate|urgent|routine"
}}
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

    async def process(self, state: dict) -> dict:
        text = state["normalized_text"]
        lang_code = state["language_code"]
        parsed_data = None

        if self.llm_available and HumanMessage is not None:
            try:
                response = await self.llm.ainvoke([HumanMessage(content=self.build_gemini_prompt(text, lang_code))])
                content = response.content.strip()
                if content.startswith("```json"):
                    content = content.replace("```json", "").replace("```", "").strip()
                parsed_data = json.loads(content)
            except Exception as exc:
                state["errors"].append(f"Parsing LLM fallback triggered: {exc}")

        if parsed_data is None:
            parsed_data = self.heuristic_parse(text)

        distress_score = self.calculate_distress_score(text)
        location = {
            "raw_text": parsed_data.get("location_text", ""),
            "landmark": parsed_data.get("landmark", ""),
            "latitude": None,
            "longitude": None,
            "confidence": 0.88 if parsed_data.get("location_text") else 0.3,
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
        }
