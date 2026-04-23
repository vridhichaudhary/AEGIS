from typing import Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from config.settings import settings
import json
import re
from agents.base_agent import BaseAgent

class ParsedIncident(BaseModel):
    """Structured output from parsing"""
    location_text: str = Field(description="Extracted location description")
    landmark: Optional[str] = Field(description="Mentioned landmark if any")
    incident_category: str = Field(description="medical, fire, accident, natural_disaster, violence, or other")
    incident_subcategory: Optional[str] = Field(description="More specific type if clear")
    victim_count: int = Field(description="Number of people affected, default 1")
    severity_indicators: list[str] = Field(description="Words/phrases indicating severity")
    urgency_level: str = Field(description="immediate, urgent, or routine")

class ParsingAgent(BaseAgent):
    """
    Extracts structured information from unstructured panicked text.
    Handles: Hindi/Hinglish/English, landmarks, incomplete addresses, distress signals
    """
    
    def __init__(self):
        super().__init__(temperature=0)
        self.parser = JsonOutputParser(pydantic_object=ParsedIncident)
    
    def build_system_prompt(self, language_code: str) -> str:
        """Build context-aware system prompt"""
        
        base_prompt = """You are an expert emergency call analyst for India's emergency services.

Your task: Extract structured information from panicked, fragmented emergency calls.

Key challenges you handle:
1. Incomplete addresses with landmarks ("near Hanuman Mandir, Sector 14")
2. Panic-fragmented speech ("please... aag... third floor... jaldi...")
3. Mixed Hindi-English (Hinglish)
4. Implicit severity cues (screaming, repetition, "jaldi karo")

Extract the following with maximum accuracy:
- Location: Full text as stated, including landmarks
- Incident type: Be specific but don't over-infer
- Victim count: Extract if mentioned, otherwise assume 1
- Severity indicators: Words showing urgency (unconscious, bleeding, trapped, etc.)

CRITICAL: Do not hallucinate details not in the text. If unclear, extract what IS clear."""

        if language_code in ['hi', 'hi-en']:
            base_prompt += """

Common Hindi urgency terms to recognize:
- jaldi (quickly), please, bachao (save), help
- aag lagi hai (fire started), accident ho gaya
- behosh (unconscious), khoon (blood), gir gaya (fell down)
- fas gaye hain (trapped), nikal nahi pa rahe (can't get out)"""

        return base_prompt
    
    def calculate_distress_score(self, text: str) -> float:
        """
        Calculate 0-1 distress score based on linguistic patterns
        """
        indicators = {
            'repetition': len(re.findall(r'\b(\w+)\s+\1\b', text.lower())) * 0.1,
            'caps': (sum(1 for c in text if c.isupper()) / max(len(text), 1)) * 0.3,
            'fragmentation': text.count('...') * 0.05,
            'urgency_words': sum(0.1 for word in ['please', 'jaldi', 'help', 'bachao', 'urgent'] if word in text.lower())
        }
        
        return min(sum(indicators.values()), 1.0)
    
    async def process(self, state: dict) -> dict:
        """
        Extract structured data from normalized text
        """
        text = state["normalized_text"]
        lang_code = state["language_code"]
        
        system_prompt = self.build_system_prompt(lang_code)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"""Extract structured information from this emergency call:

"{text}"

Return JSON matching this schema:
{self.parser.get_format_instructions()}""")
        ]
        
        try:
            response = await self.llm.ainvoke(messages)
            parsed = self.parser.parse(response.content)
            
            # Calculate distress score
            distress_score = self.calculate_distress_score(text)
            
            # Build Location object
            location = {
                "raw_text": parsed.location_text,
                "landmark": parsed.landmark,
                "confidence": 0.7  # Will be improved by geocoding
            }
            
            # Build IncidentType
            incident_type = {
                "category": parsed.incident_category,
                "subcategory": parsed.incident_subcategory,
                "confidence": 0.8
            }
            
            # Log reasoning
            state["agent_trail"].append({
                "agent": "parsing",
                "timestamp": state["timestamp"],
                "decision": f"Extracted: {parsed.incident_category} at {parsed.location_text}",
                "reasoning": f"Severity indicators: {', '.join(parsed.severity_indicators)}"
            })
            
            return {
                **state,
                "location": location,
                "incident_type": incident_type,
                "victim_count": parsed.victim_count,
                "severity_clues": parsed.severity_indicators,
                "distress_score": distress_score
            }
            
        except Exception as e:
            state["errors"].append(f"Parsing failed: {str(e)}")
            # Return minimal safe extraction
            return {
                **state,
                "location": {"raw_text": text[:100], "confidence": 0.3},
                "incident_type": {"category": "other", "confidence": 0.3},
                "victim_count": 1,
                "severity_clues": [],
                "distress_score": 0.5
            }