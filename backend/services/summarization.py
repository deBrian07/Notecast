import requests
from core.config import settings

def generate_summary(text: str) -> str:
    system = (
        "You are an AI that writes a podcast-style summary as a dialogue between two hosts. "
        "Keep it engaging and concise."
    )
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text}
        ],
        "temperature": 0.7,
        "stream": False
    }
    url = f"{settings.OLLAMA_URL}/v1/chat/completions"
    resp = requests.post(url, json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]