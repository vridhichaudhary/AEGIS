import asyncio
import os
from config.settings import settings
from langchain_groq import ChatGroq

async def test_groq():
    if not settings.GROQ_API_KEY:
        print("GROQ_API_KEY not found in settings")
        return

    try:
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=settings.GROQ_API_KEY,
            temperature=0,
        )
        response = await llm.ainvoke("Hello, are you working?")
        print(f"Groq Response: {response.content}")
        print("Groq API is working!")
    except Exception as e:
        print(f"Groq API Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_groq())
