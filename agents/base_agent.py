from __future__ import annotations

from typing import Optional

from config.settings import settings

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover - exercised in dependency-light environments
    ChatGoogleGenerativeAI = None


class BaseAgent:
    """Base class that gracefully falls back when Gemini is unavailable."""

    def __init__(self, temperature: float = 0):
        self.llm = self.initialize_llm(temperature)

    @property
    def llm_available(self) -> bool:
        return self.llm is not None

    def initialize_llm(self, temperature: float) -> Optional["ChatGoogleGenerativeAI"]:
        """Initialize Gemini only when the dependency and API key are both present."""
        if ChatGoogleGenerativeAI is None or not settings.GOOGLE_API_KEY:
            return None

        return ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=temperature,
            max_output_tokens=2048,
            convert_system_message_to_human=True,
        )
