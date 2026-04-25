from __future__ import annotations

import asyncio
import os
from typing import Optional

from config.settings import settings

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover - exercised in dependency-light environments
    ChatGoogleGenerativeAI = None

try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None

try:
    from langchain_xai import ChatXAI
except ImportError:
    ChatXAI = None


class BaseAgent:
    """Base class that gracefully falls back when LLM is unavailable or slow."""

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
            "has_api_key": bool(settings.GOOGLE_API_KEY or settings.GROQ_API_KEY or settings.XAI_API_KEY),
            "google_genai_dependency": ChatGoogleGenerativeAI is not None,
            "groq_dependency": ChatGroq is not None,
            "xai_dependency": ChatXAI is not None,
            "llm_initialized": self.llm is not None,
            "timeout_seconds": settings.LLM_TIMEOUT_SECONDS,
        }

    def initialize_llm(self, temperature: float):
        if os.environ.get("AEGIS_DISABLE_LLM", "").lower() in {"1", "true", "yes"}:
            return None

        provider = settings.LLM_PROVIDER.lower()

        # If Google is selected
        if provider == "google" and settings.GOOGLE_API_KEY and ChatGoogleGenerativeAI is not None:
            return ChatGoogleGenerativeAI(
                model=settings.LLM_MODEL,
                google_api_key=settings.GOOGLE_API_KEY,
                temperature=temperature,
                max_output_tokens=2048,
                convert_system_message_to_human=True,
            )

        # If Groq is selected
        if provider == "groq" and settings.GROQ_API_KEY and ChatGroq is not None:
            return ChatGroq(
                model="llama-3.3-70b-versatile",
                api_key=settings.GROQ_API_KEY,
                temperature=temperature,
                max_tokens=2048,
            )

        # If xAI is selected
        if provider == "xai" and settings.XAI_API_KEY and ChatXAI is not None:
            return ChatXAI(
                model="grok-beta",
                xai_api_key=settings.XAI_API_KEY,
                temperature=temperature,
                max_tokens=2048,
            )

        # Fallback Chain if preferred provider fails/missing
        if settings.GROQ_API_KEY and ChatGroq is not None:
            return ChatGroq(
                model="llama-3.3-70b-versatile",
                api_key=settings.GROQ_API_KEY,
                temperature=temperature,
            )
            
        if settings.GOOGLE_API_KEY and ChatGoogleGenerativeAI is not None:
            return ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=settings.GOOGLE_API_KEY,
                temperature=temperature,
            )

        return None

    async def invoke_llm(self, messages):
        if not self.llm:
            raise RuntimeError("LLM is not initialized")
        return await asyncio.wait_for(
            self.llm.ainvoke(messages),
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )
