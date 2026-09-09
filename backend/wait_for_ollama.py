import sys
import time

import requests

from core.config import settings


def _model_present(models: list, wanted: str) -> bool:
    wanted_base = wanted.split(":")[0]
    for name in models:
        if name == wanted or name.startswith(f"{wanted}:") or name.split(":")[0] == wanted_base:
            return True
    return False


def wait_and_pull() -> None:
    base = settings.ollama_url.rstrip("/")
    print(f"Waiting for Ollama at {base}...")
    for _ in range(90):
        try:
            response = requests.get(f"{base}/api/tags", timeout=5)
            if response.ok:
                break
        except requests.RequestException:
            pass
        time.sleep(2)
    else:
        print("Ollama did not become ready", file=sys.stderr)
        sys.exit(1)

    tags = requests.get(f"{base}/api/tags", timeout=10).json()
    models = [item.get("name", "") for item in tags.get("models", [])]
    wanted = settings.ollama_model
    if _model_present(models, wanted):
        print(f"Ollama model {wanted} is already available")
        return

    print(f"Pulling Ollama model {wanted} (first run can take a few minutes)...")
    with requests.post(f"{base}/api/pull", json={"name": wanted}, stream=True, timeout=None) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                print(line.decode("utf-8", errors="replace"))
    print(f"Pulled {wanted}")


if __name__ == "__main__":
    wait_and_pull()
