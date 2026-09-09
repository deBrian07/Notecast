# Notecast

Turn documents into a two-host podcast and chat with them. React frontend, FastAPI backend, Ollama for language, Edge TTS for audio.

## Run with Docker

You need [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000).

The first start downloads the Ollama image and pulls `llama3.2`. That can take several minutes. Later starts reuse the volume.

API docs stay at [http://localhost:8000/docs](http://localhost:8000/docs).

Stop with `Ctrl+C`, or `docker compose down`. Uploads, podcasts, and the database live in the `backend_data` volume. The model lives in the `ollama` volume.

### Optional `.env`

```bash
cp .env.example .env
```

| Variable | Default |
|---|---|
| `SECRET_KEY` | `change-me-in-production` |
| `OLLAMA_MODEL` | `llama3.2` |
| `TTS_ENGINE` | `edge` |
| `TTS_VOICE_FEMALE` | `en-US-AriaNeural` |
| `TTS_VOICE_MALE` | `en-US-GuyNeural` |

## Use it

1. Register / log in
2. Create a project
3. Upload a PDF or DOCX
4. Chat with the documents, or generate a podcast in Studio

## Repo layout

```
backend/     FastAPI, TTS, Ollama client
frontend/    Vite + React app
docker-compose.yml
```

## Run without Docker

```bash
# Ollama
ollama pull llama3.2

# API
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py

# UI
cd frontend
npm install
cp .env.example .env
npm run dev
```

UI: [http://localhost:5173](http://localhost:5173)  
API: [http://localhost:8000](http://localhost:8000)

## License

MIT
