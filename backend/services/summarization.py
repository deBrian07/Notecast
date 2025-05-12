import requests
from core.config import settings

OLLAMA_CHAT_URL = f"{settings.ollama_url.rstrip('/')}/api/chat"

def generate_summary(text: str, model: str | None = None) -> str:
    payload = {
        "model": model or settings.ollama_model,   # e.g. qwen3:14b
        "messages": [
            {"role": "system", "content": "Summarize the following document:"},
            {"role": "user",   "content": text}
        ],
        "stream": False
    }
    resp = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
    resp.raise_for_status()                       # will raise 404 if URL wrong
    return resp.json()["message"]["content"]