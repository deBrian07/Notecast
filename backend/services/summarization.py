import requests
from core.config import settings

OLLAMA_CHAT_URL = f"{settings.ollama_url.rstrip('/')}/api/chat"

def generate_summary(text: str, model: str | None = None) -> str:
    """
    Return a concise summary of the provided document text.
    """
    payload = {
        "model": model or settings.ollama_model,
        "messages": [
            {"role": "system", "content": "Summarize the following document:"},
            {"role": "user",   "content": text}
        ],
        "stream": False
    }
    resp = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def generate_podcast_script(summary: str, model: str | None = None) -> str:
    """
    Given a document summary, produce a conversational podcast script with
    two hosts (Host A = female, Host B = male), lasting at least five minutes.
    Each line must be prefixed with "Host A:" or "Host B:".
    """
    prompt = (
        "You are an AI assistant that writes podcast scripts. "
        "Create a dialogue between two hosts: Host A (female) and Host B (male). "
        "The conversation should cover the content of the summary and run at least "
        "five minutes when read aloud. Format each utterance like:\n"
        "Host A: ...\nHost B: ...\n"
    )
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user",   "content": f"Document summary:\n\n{summary}"}
    ]
    payload = {
        "model": model or settings.ollama_model,
        "messages": messages,
        "stream": False
    }
    resp = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=240)
    resp.raise_for_status()
    return resp.json()["message"]["content"]