from langchain_core.messages import HumanMessage
from agents.base_agent import BaseAgent
import re
import json
from datetime import datetime

class ParsingAgent(BaseAgent):
    """Extracts structured information using FREE Gemini"""
    
    def __init__(self):
        super().__init__(temperature=0)
    
    def build_gemini_prompt(self, text: str, language_code: str) -> str:
        """Gemini-optimized prompt"""
        
        prompt = f"""You are an expert emergency call analyst for India's 911 system.

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

IMPORTANT FOR HINDI/HINGLISH:
- "aag lagi hai" = fire started
- "behosh" = unconscious
- "khoon" = blood/bleeding
- "fas gaye" = trapped
- "jaldi" = quickly/urgent

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
        return prompt
    
    def calculate_distress_score(self, text: str) -> float:
        """Calculate 0-1 distress score"""
        indicators = {
            'repetition': len(re.findall(r'\b(\w+)\s+\1\b', text.lower())) * 0.1,
            'caps': (sum(1 for c in text if c.isupper()) / max(len(text), 1)) * 0.3,
            'fragmentation': text.count('...') * 0.05,
            'urgency_words': sum(0.1 for word in ['please', 'jaldi', 'help', 'bachao', 'urgent', 'emergency'] if word in text.lower())
        }
        return min(sum(indicators.values()), 1.0)
    
    async def process(self, state: dict) -> dict:
        """Extract structured data using FREE Gemini"""
        text = state["normalized_text"]
        lang_code = state["language_code"]
        
        prompt = self.build_gemini_prompt(text, lang_code)
        
        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            content = response.content.strip()
            
            # Clean Gemini output
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            
            parsed_data = json.loads(content)
            
            # Calculate distress score
            distress_score = self.calculate_distress_score(text)
            
            # Build location object
            location = {
                "raw_text": parsed_data.get("location_text", ""),
                "landmark": parsed_data.get("landmark", ""),
                "latitude": None,
                "longitude": None,
                "confidence": 0.7
            }
            
            # Build incident type
            incident_type = {
                "category": parsed_data.get("incident_category", "other"),
                "subcategory": parsed_data.get("incident_subcategory", ""),
                "confidence": 0.8
            }
            
            # Log reasoning
            state["agent_trail"].append({
                "agent": "parsing",
                "timestamp": datetime.now(),
                "decision": f"Extracted: {incident_type['category']} at {location['raw_text']}",
                "reasoning": f"Severity indicators: {', '.join(parsed_data.get('severity_indicators', []))}"
            })
            
            return {
                **state,
                "location": location,
                "incident_type": incident_type,
                "victim_count": parsed_data.get("victim_count", 1),
                "severity_clues": parsed_data.get("severity_indicators", []),
                "distress_score": distress_score
            }
            
        except Exception as e:
            state["errors"].append(f"Parsing failed: {str(e)}")
            return {
                **state,
                "location": {"raw_text": text[:100], "confidence": 0.3, "latitude": None, "longitude": None, "landmark": ""},
                "incident_type": {"category": "other", "confidence": 0.3, "subcategory": ""},
                "victim_count": 1,
                "severity_clues": [],
                "distress_score": 0.5
            }