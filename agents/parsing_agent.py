import json
import re
from datetime import datetime

from agents.base_agent import BaseAgent

try:
    from langchain_core.messages import HumanMessage
except ImportError:  # pragma: no cover - optional dependency
    HumanMessage = None


class ParsingAgent(BaseAgent):
    """Extracts structured information with an LLM when available, else heuristics."""

    INCIDENT_PATTERNS = {
        "fire": ["fire", "aag", "smoke", "burning", "flames"],
        "medical": [
            "heart attack",
            "ambulance",
            "unconscious",
            "behosh",
            "bleeding",
            "khoon",
            "not breathing",
            "cardiac",
            "pregnant",
        ],
        "accident": ["accident", "crash", "collision", "truck hit", "gadi", "injured"],
        "natural_disaster": ["flood", "earthquake", "landslide", "storm", "building collapse"],
        "violence": ["gun", "knife", "fight", "attack", "violence", "robbery", "police"],
    }

    SEVERITY_KEYWORDS = [
        "unconscious",
        "behosh",
        "bleeding",
        "khoon",
        "trapped",
        "faase",
        "fas",
        "smoke",
        "fire",
        "heart attack",
        "not breathing",
        "cardiac",
    ]

    LOCATION_PATTERNS = [
        r"(Sector\s+\d+[A-Za-z\-]*)",
        r"(near\s+[A-Za-z0-9\s]+)",
        r"([A-Za-z0-9\s]+ Mall)",
        r"([A-Za-z0-9\s]+ Mandir)",
        r"([A-Za-z0-9\s]+ Station)",
        r"([A-Za-z0-9\s]+ Hospital)",
    ]

    def __init__(self):
        super().__init__(temperature=0)

    def build_gemini_prompt(self, text: str, language_code: str) -> str:
        return f"""You are an expert emergency call analyst for India's 911 system.

TASK: Extract structured information from this panicked emergency call.

CALL TRANSCRIPT:
"{text}"

DETECTED LANGUAGE: {language_code}

INSTRUCTIONS:
1. Extract location (include landmarks like "near Hanuman Mandir")
2. Classify incident: medical, fire, accident, natural_disaster, violence, or other
3. Count victims (if mentioned, otherwise 1)
4. Identify severity indicators (unconscious, bleeding, trapped, fire, etc.)
5. Rate urgency: immediate, urgent, or routine

Return ONLY valid JSON matching this exact schema:
{{
  "location_text": "extracted location",
  "landmark": "landmark if mentioned or empty string",
  "incident_category": "medical|fire|accident|natural_disaster|violence|other",
  "incident_subcategory": "specific type or empty string",
  "victim_count": 1,
  "severity_indicators": ["indicator1", "indicator2"],
  "urgency_level": "immediate|urgent|routine"
}}

JSON OUTPUT:"""

    def calculate_distress_score(self, text: str) -> float:
        indicators = {
            "repetition": len(re.findall(r"\b(\w+)\s+\1\b", text.lower())) * 0.1,
            "caps": (sum(1 for c in text if c.isupper()) / max(len(text), 1)) * 0.3,
            "fragmentation": text.count("...") * 0.05,
            "urgency_words": sum(
                0.1
                for word in ["please", "jaldi", "help", "bachao", "urgent", "emergency"]
                if word in text.lower()
            ),
        }
        return min(sum(indicators.values()), 1.0)

    def extract_location(self, text: str) -> tuple[str, str]:
        for pattern in self.LOCATION_PATTERNS:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                location = match.group(1).strip()
                landmark = location if any(
                    keyword in location.lower()
                    for keyword in ["mall", "mandir", "station", "hospital"]
                ) else ""
                return location, landmark
        return "", ""

    def classify_incident(self, text: str) -> tuple[str, str]:
        lowered = text.lower()
        for category, keywords in self.INCIDENT_PATTERNS.items():
            if any(keyword in lowered for keyword in keywords):
                return category, ""
        return "other", ""

    def extract_victim_count(self, text: str) -> int:
        digits = re.findall(r"\b(\d+)\b", text)
        if digits:
            return max(1, int(digits[0]))

        word_map = {
            "one": 1,
            "two": 2,
            "three": 3,
            "four": 4,
            "five": 5,
            "ek": 1,
            "do": 2,
            "teen": 3,
            "char": 4,
            "paanch": 5,
        }
        lowered = text.lower()
        for word, count in word_map.items():
            if re.search(rf"\b{word}\b", lowered):
                return count
        return 1

    def extract_severity_indicators(self, text: str) -> list[str]:
        lowered = text.lower()
        return [keyword for keyword in self.SEVERITY_KEYWORDS if keyword in lowered]

    def heuristic_parse(self, text: str) -> dict:
        location_text, landmark = self.extract_location(text)
        category, subcategory = self.classify_incident(text)
        severity_indicators = self.extract_severity_indicators(text)
        urgency = "immediate" if severity_indicators else "urgent" if "urgent" in text.lower() else "routine"

        return {
            "location_text": location_text,
            "landmark": landmark,
            "incident_category": category,
            "incident_subcategory": subcategory,
            "victim_count": self.extract_victim_count(text),
            "severity_indicators": severity_indicators,
            "urgency_level": urgency,
        }

    async def process(self, state: dict) -> dict:
        text = state["normalized_text"]
        lang_code = state["language_code"]
        parsed_data = None

        if self.llm_available and HumanMessage is not None:
            prompt = self.build_gemini_prompt(text, lang_code)
            try:
                response = await self.llm.ainvoke([HumanMessage(content=prompt)])
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
            "confidence": 0.85 if parsed_data.get("location_text") else 0.3,
        }
        incident_type = {
            "category": parsed_data.get("incident_category", "other"),
            "subcategory": parsed_data.get("incident_subcategory", ""),
            "confidence": 0.85 if parsed_data.get("incident_category") != "other" else 0.4,
        }

        state["agent_trail"].append(
            {
                "agent": "parsing",
                "timestamp": datetime.now(),
                "decision": f"Extracted: {incident_type['category']} at {location['raw_text'] or 'unknown location'}",
                "reasoning": f"Severity indicators: {', '.join(parsed_data.get('severity_indicators', [])) or 'none'}",
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
