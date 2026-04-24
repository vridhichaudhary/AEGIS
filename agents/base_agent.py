from __future__ import annotations

import asyncio
import os
from typing import Optional

from config.settings import settings

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover - exercised in dependency-light environments
    ChatGoogleGenerativeAI = None


class BaseAgent:
    """Base class that gracefully falls back when Gemini is unavailable or slow."""

    def __init__(self, temperature: float = 0):
        self.llm = self.initialize_llm(temperature)

    @property
    def llm_available(self) -> bool:
        return self.llm is not None

    @property
    def llm_diagnostics(self) -> dict:
        return {
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL,
            "has_api_key": bool(settings.GOOGLE_API_KEY),
            "google_genai_dependency": ChatGoogleGenerativeAI is not None,
            "llm_initialized": self.llm is not None,
            "timeout_seconds": settings.LLM_TIMEOUT_SECONDS,
        }

    def initialize_llm(self, temperature: float) -> Optional["ChatGoogleGenerativeAI"]:
        if os.environ.get("AEGIS_DISABLE_LLM", "").lower() in {"1", "true", "yes"}:
            return None
        if ChatGoogleGenerativeAI is None or not settings.GOOGLE_API_KEY:
            return None

        return ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=temperature,
            max_output_tokens=2048,
            convert_system_message_to_human=True,
        )

    async def invoke_llm(self, messages):
        if not self.llm:
            raise RuntimeError("LLM is not initialized")
        return await asyncio.wait_for(
            self.llm.ainvoke(messages),
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )
