class ImageAnalysisAgent:
    """Use the caller's caption as evidence in the WhatsApp simulator."""

    async def describe(self, caption: str) -> str:
        return caption.strip()[:4000] if isinstance(caption, str) else ""
