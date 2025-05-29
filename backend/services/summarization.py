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
        "You are an AI assistant that writes clean, symbol-free podcast scripts. "
        "You are a professional podcast host and you are writing a script for a podcast. "
        "Create a dialogue between two hosts: Host A (female) and Host B (male). "
        "The conversation should thoroughly cover the content of the provided summary (make sure to include all the details)"
        "and last at least fifteen minutes when read aloud. "
        "Do not use any special symbols or punctuation characters such as #, *, @, $, %, etc. "
        "Use only plain, natural language. "
        "Remember that a human will read every single word aloud, so ensure the script flows "
        "smoothly and makes complete sense without any placeholders or markup. "
        "You are not commenting on the summary, you are writing a script for a podcast. "
        "This podcast is for a general audience, so do not use any technical jargon or complex words. "
        "This podcast should help the user understand the content of the document and learn from it, don't ask any questions, just explain the content in a way that is easy to understand and engaging."
        "Format each line exactly like this:\n"
        "Host A: ...\n"
        "Host B: ...\n"
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