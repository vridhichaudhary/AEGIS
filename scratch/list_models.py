import google.generativeai as genai
import os
from config.settings import settings

def list_models():
    genai.configure(api_key=settings.GOOGLE_API_KEY)
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)

if __name__ == "__main__":
    list_models()
