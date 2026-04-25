import asyncio
import os
from config.settings import settings
from langchain_google_genai import ChatGoogleGenerativeAI

async def test_gemini():
    if not settings.GOOGLE_API_KEY:
        print("GOOGLE_API_KEY not found in settings")
        return

    print(f"Testing Gemini Flash Latest with key: {settings.GOOGLE_API_KEY[:10]}...")
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0,
        )
        response = await llm.ainvoke("Hello, are you working?")
        print(f"Gemini Response: {response.content}")
        print("Gemini API is working!")
    except Exception as e:
        print(f"Gemini API Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini())
