<p align="center">
  <img src="docs/logo.png" alt="CLARITY logo" width="220">
</p>

# CLARITY (working title)

**A unified corporate workspace** combining task tracking, real-time chat, video meetings, and GitHub integration in one place — built to eliminate the "meeting about the meeting" problem for cross-functional teams.

Built as a portfolio project by [Kgothatso Mokgashi](https://github.com/LORDE01V) to demonstrate production-grade full-stack + AI system design, using a fully free-tier infrastructure stack.

## Why This Exists

Corporate teams juggle Jira for tasks, Zoom/Teams for meetings, Slack for chat, and GitHub for code — with no single source of truth linking them. When a client call happens, whoever attended has to manually relay decisions to the rest of the team, often via another meeting. This project automates that hand-off: **record → transcribe → summarize → review → send**, with full attribution for accountability.

## Core Features

- **Org hierarchy & invites** — CEO/PM-level roles can create teams, invite members, and scope permissions per group
- **Task tracker** — Kanban-style, auto-linked to GitHub PRs/issues
- **Real-time chat** — team and group channels, mentions, presence
- **Video meetings** — WebRTC-based calls with recording + live transcription
- **AI meeting recaps** — auto-transcribed calls generate a draft summary + action items, editable before sending to email or in-app chat, with full edit-attribution logged
- **GitHub sync** — GitHub App + webhooks link commits/PRs/issues directly to tasks

## Tech Stack (100% Free Tier)

| Layer | Tool |
|---|---|
| Backend | FastAPI (Python) on Render |
| Database / Auth / Realtime | Supabase (Postgres) |
| Frontend | React + TypeScript on Cloudflare Pages |
| Video | Jitsi Meet (embedded / self-hosted on Oracle Cloud Free Tier) |
| Transcription | Whisper (self-hosted via Hugging Face Spaces) |
| Summarization | Open-weight LLMs via OpenRouter / HF Inference (free tier) |
| GitHub integration | GitHub App + Webhooks |
| CI/CD | GitHub Actions |

> This project is deliberately architected for **zero infrastructure cost**, using open-weight models and free-tier managed services in place of paid APIs — a demonstration of cost-conscious system design, not just feature-building.

## Architecture (high level)

```
Client (React/TS) ──> FastAPI backend ──> Supabase (Postgres/Auth/Realtime)
                              │
                              ├──> Jitsi (video) ──> Whisper (transcription)
                              │                           │
                              │                           v
                              │                  LLM summarization (OpenRouter/HF)
                              │                           │
                              │                           v
                              │                  Draft recap ──> review/edit ──> send (email/chat)
                              │
                              └──> GitHub App/Webhooks ──> Task auto-linking
```

## Roles & Permissions

- **Owner (CEO)** — org-wide access, creates top-level teams
- **Project Manager** — creates groups, invites members, assigns tasks
- **Member** — scoped to invited teams/groups only
- **Guest (client)** — read-only access to specific shared threads

## Status

🚧 In active development. Build order: Auth/RBAC → Tasks → Chat → Meetings → GitHub sync → AI recap pipeline → tests/CI throughout.

## Local Setup

```bash
# Backend
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Environment variables: copy `backend/.env.example` → `backend/.env` and
`frontend/.env.example` → `frontend/.env`. Do not commit `.env` files or secrets.

### Go live locally (real Supabase)

For register/login, orgs, invites, and tasks against a live project:

1. Paste Supabase **Project URL**, **anon**, **service_role**, and **JWT Secret**
   into `backend/.env` (and URL + anon into `frontend/.env`) from
   [Project Settings → API](https://supabase.com/dashboard).
2. Set `VITE_AUTH_BYPASS=false` and `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`.
3. Run SQL migrations `001` → `003` in the Supabase SQL Editor
   (`backend/supabase/migrations/`).
4. Restart uvicorn and `npm run dev`.

Full checklist: [docs/go-live-locally.md](docs/go-live-locally.md).

Leave `VITE_AUTH_BYPASS` unset/true only to explore the UI without Supabase.

### GitHub App (local webhooks)

Fill `GITHUB_*` in `backend/.env` (see `.env.example`), including
`GITHUB_APP_SLUG` for **Connect GitHub**. Save the App private key as a `.pem`
file and set `GITHUB_PRIVATE_KEY_PATH`. Forward webhooks with:

```bash
npx smee -u https://smee.io/YOUR_CHANNEL -t http://127.0.0.1:8000/api/v1/github/webhooks
```

Details: [docs/github-app.md](docs/github-app.md).

## License

This project is licensed under the [MIT License](LICENSE).