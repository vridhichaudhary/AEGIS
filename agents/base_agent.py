from langchain_google_genai import ChatGoogleGenerativeAI
from config.settings import settings

class BaseAgent:
    """Base class for all agents with FREE Gemini integration"""
    
    def __init__(self, temperature: float = 0):
        self.llm = self.initialize_llm(temperature)
    
    def initialize_llm(self, temperature: float):
        """Initialize FREE Gemini model"""
        return ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=temperature,
            max_output_tokens=2048,
            convert_system_message_to_human=True
        )