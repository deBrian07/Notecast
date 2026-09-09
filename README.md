# Notecast

Turn documents into a two-host podcast and chat with them. A small NotebookLM-style app: React frontend + FastAPI backend, with Ollama for language and Edge TTS for audio.

## What you need

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com)
- [ffmpeg](https://ffmpeg.org) (for podcast MP3s)

You do **not** need a GPU for the default setup.

## Setup

### 1. Ollama

```bash
ollama pull llama3.2
```

Leave the Ollama app running.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

API: [http://localhost:8000](http://localhost:8000)  
Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The database is created on first start (`backend/data/notecast.db`).

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

## Use it

1. Register / log in
2. Create a project
3. Upload a PDF or DOCX
4. Chat with the documents, or generate a podcast in Studio

Generation can take a few minutes. The UI polls until the audio is ready, then loads it.

## Config

`backend/.env` (see `.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Local Ollama |
| `OLLAMA_MODEL` | `llama3.2` | Any model you have pulled |
| `TTS_ENGINE` | `edge` | `edge` (no GPU) or `nemo` (CUDA) |
| `TTS_VOICE_FEMALE` | `en-US-AriaNeural` | Edge voice name |
| `TTS_VOICE_MALE` | `en-US-GuyNeural` | Edge voice name |
| `SECRET_KEY` | `change-me-in-production` | Change this before you deploy |

`client/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Health check: [http://localhost:8000/health](http://localhost:8000/health) reports whether Ollama is reachable.

## Optional GPU TTS

If you have an NVIDIA GPU and want NeMo voices:

```bash
cd backend
pip install -r requirements-gpu.txt
```

Set in `.env`:

```env
TTS_ENGINE=nemo
TTS_VOICE_FEMALE=female_dainty
TTS_VOICE_MALE=male_deep
```

## Troubleshooting

**Frontend cannot reach the API.** Check `client/.env` has `VITE_API_URL=http://localhost:8000` and restart `npm run dev`.

**Podcast generation hangs, then times out.** `curl http://localhost:8000/health` — `ollama` should be `true`. Confirm `ollama pull llama3.2` finished.

**TTS fails.** Install ffmpeg (`brew install ffmpeg` on macOS) and confirm `TTS_ENGINE=edge`.

**Wrong API in the browser.** Old builds pointed at `https://api.infinia.chat`. Use the `.env` value above.

## License

MIT
