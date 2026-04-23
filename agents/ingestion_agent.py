import re
from datetime import datetime

class IngestionAgent:
    """Normalizes raw input, detects language"""
    
    def detect_language(self, text: str) -> str:
        """Detect if text is Hindi, English, or Hinglish"""
        has_hindi = bool(re.search(r'[\u0900-\u097F]', text))
        has_english = bool(re.search(r'[a-zA-Z]', text))
        
        if has_hindi and has_english:
            return 'hi-en'
        elif has_hindi:
            return 'hi'
        else:
            return 'en'
    
    def normalize_text(self, text: str) -> str:
        """Clean and normalize text"""
        text = text.encode('utf-8', errors='ignore').decode('utf-8')
        text = ' '.join(text.split())
        text = re.sub(r'\s*([.!?,])\s*', r'\1 ', text)
        return text.strip()
    
    async def process(self, state: dict) -> dict:
        """Main processing function"""
        raw_text = state["raw_transcript"]
        normalized = self.normalize_text(raw_text)
        lang_code = self.detect_language(normalized)
        
        state["agent_trail"].append({
            "agent": "ingestion",
            "timestamp": datetime.now(),
            "decision": f"Detected language: {lang_code}",
            "reasoning": f"Normalized {len(raw_text)} chars to {len(normalized)} chars"
        })
        
        return {
            **state,
            "normalized_text": normalized,
            "language_code": lang_code
        }