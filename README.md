# MyClaw3D

MyClaw3D is an isometric 3D agent workspace built with React + Three.js.
It combines local in-world animations (movement, desk/sofa/sports activities) with real AI chat through an OpenClaw gateway.

![MyClaw3D](https://img.shields.io/badge/Built%20with-Three.js-black?style=flat&logo=threedotjs)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![OpenClaw](https://img.shields.io/badge/OpenClaw-Connected-c8a050?style=flat)

## What Changed Recently

- Added more world systems and UX panels: docs modal, tools modal, settings modal, inbox/history/playbooks panels.
- Added local server APIs for events, inbox, playbooks, and per-agent routing settings.
- Added OpenClaw-backed agent chat flow through a local API proxy.
- Added server-side persistence under `server/.data` for playbooks, events, inbox, and agent settings.
- Added per-agent OpenClaw mapping + model selection from the settings UI.

## Core Features

- Interactive isometric world with multiple rooms and animated agents.
- 6 role-based agents with local behaviors and AI chat.
- Live desk terminals, wall chart screens, monitor modal.
- HQ control surfaces: Inbox, History, Playbooks, Observe, Tools, Settings.
- OpenClaw integration for streamed chat and tool invocation.

## Chat Command Examples

Command support depends on the current chat parser in `src/components/ClawHQ.jsx`, but typical local behavior commands include:

- go to desk / work
- relax / sofa / chill
- play ping pong
- play pool / billiards
- stand up / stop

## Proper OpenClaw Connection Setup

This app has two local processes:

1. Frontend (Vite) on port 3000
2. Local API server (Express) on port 8787

The frontend calls `/api/*`, and Vite proxies that to the local API server, which then calls OpenClaw.

### 1) Start OpenClaw Gateway

Run your OpenClaw Gateway so that the OpenAI-compatible endpoint is reachable (default expected base URL):

- `http://127.0.0.1:18789`

### 2) Set Required Environment Variables (PowerShell)

In the terminal where you will run the local API server:

```powershell
$env:OPENCLAW_GATEWAY_TOKEN="your_gateway_token_here"
$env:OPENCLAW_BASE_URL="http://127.0.0.1:18789"
```

Optional routing defaults:

```powershell
$env:OPENCLAW_AGENT_ID="main"
# Optional JSON map string for agent routing
# $env:OPENCLAW_AGENT_MAP_JSON='{"alpha":"agent-a","bravo":"agent-b"}'
```

### 3) Run Local API Server

```bash
npm run server
```

### 4) Run Frontend Dev Server (new terminal)

```bash
npm run dev
```

### 5) Verify Health

Open this endpoint in your browser:

- `http://127.0.0.1:8787/api/health`

You should see:

- `ok: true`
- `hasToken: true`

If `hasToken` is false, your server terminal does not have `OPENCLAW_GATEWAY_TOKEN` set.

## Local Development

```bash
npm install
npm run build
```

## Architecture

```text
src/
  main.jsx
  components/
    ClawHQ.jsx

server/
  index.mjs
  .data/
    events.json
    inbox.json
    playbooks.json
    agent-settings.json
```

## Tech Stack

- React 18
- Three.js
- Tone.js
- Vite
- Express

## License

MIT
