from __future__ import annotations

from agents.base_agent import BaseAgent
from langchain_core.messages import HumanMessage


class ImageAnalysisAgent(BaseAgent):
    """Analyses emergency images shared via WhatsApp using Gemini Vision."""

    def __init__(self):
        super().__init__(temperature=0)

    async def describe(self, image_url: str) -> str:
        """
        Describe the emergency situation visible in an image.
        In production this would send the image bytes/URL to Gemini Vision.
        Here we return a realistic mock description for demo purposes.
        """
        if self.llm_available and HumanMessage is not None:
            try:
                prompt = (
                    f"You are an emergency dispatcher AI. An image has been shared from a WhatsApp emergency report "
                    f"(URL: {image_url}). Describe the likely emergency situation visible in the image "
                    f"in 1-2 sentences suitable for a 112 dispatcher. Focus on: type of emergency, "
                    f"visible injuries or damage, and estimated number of people involved."
                )
                response = await self.invoke_llm([HumanMessage(content=prompt)])
                return response.content.strip()
            except Exception as exc:
                print(f"ImageAnalysisAgent LLM failed: {exc}")

        # Realistic mock fallback
        return (
            "WhatsApp image shows a road accident with significant vehicle damage. "
            "At least 2 injured persons visible near the vehicles. Possible head injuries."
        )
