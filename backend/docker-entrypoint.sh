#!/bin/sh
set -e

if [ "${ENSURE_OLLAMA:-}" = "true" ] || [ "${ENSURE_OLLAMA:-}" = "1" ]; then
  python wait_for_ollama.py
fi

exec uvicorn app:app --host 0.0.0.0 --port 8000
