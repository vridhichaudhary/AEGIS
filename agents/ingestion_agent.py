import re
from datetime import datetime


class IngestionAgent:
    """Normalizes raw input and detects English, Hindi, and Hinglish reliably."""

    HINGLISH_MARKERS = {
        "aag",
        "behosh",
        "saans",
        "nahi",
        "jaldi",
        "bachao",
        "madad",
        "phas",
        "phase",
        "faase",
        "aadmi",
        "log",
        "gaadi",
        "paani",
        "dard",
        "khoon",
        "danga",
        "chaku",
        "ghar",
        "bacha",
        "bachche",
        "maa",
        "meri",
        "wife",
        "ho gaya",
        "bhejo",
        "turant",
    }

    def detect_language(self, text: str) -> str:
        has_devanagari = bool(re.search(r"[\u0900-\u097F]", text))
        has_latin = bool(re.search(r"[a-zA-Z]", text))
        lowered = text.lower()
        has_hinglish_markers = any(marker in lowered for marker in self.HINGLISH_MARKERS)

        if has_devanagari and has_latin:
            return "hi-en"
        if has_devanagari:
            return "hi"
        if has_latin and has_hinglish_markers:
            return "hi-en"
        return "en"

    def normalize_text(self, text: str) -> str:
        text = text.encode("utf-8", errors="ignore").decode("utf-8")
        text = text.replace("’", "'").replace("“", '"').replace("”", '"')
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"\s*([.!?,:/-])\s*", r" \1 ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    async def process(self, state: dict) -> dict:
        raw_text = state["raw_transcript"]
        normalized = self.normalize_text(raw_text)
        lang_code = self.detect_language(normalized)

        state["agent_trail"].append(
            {
                "agent": "ingestion",
                "timestamp": datetime.now(),
                "decision": f"Detected language: {lang_code}",
                "reasoning": f"Normalized {len(raw_text)} chars to {len(normalized)} chars",
            }
        )

        return {**state, "normalized_text": normalized, "language_code": lang_code}
