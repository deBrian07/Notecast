# Frontend

Vite + React UI for Notecast.

For the normal path, use Docker Compose from the repo root:

```bash
docker compose up --build
```

To run this folder by itself:

```bash
npm install
cp .env.example .env
npm run dev
```

That expects the API at `http://localhost:8000`.
