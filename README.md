# 0xMerl HQ — AI Agent Command Center

A 3D isometric virtual headquarters for managing autonomous AI agents. Built with React + Three.js.

![0xMerl HQ](https://img.shields.io/badge/status-alpha-c8a050?style=flat-square) ![Three.js](https://img.shields.io/badge/Three.js-r160-black?style=flat-square) ![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

## Overview

0xMerl HQ is an interactive 3D office environment where AI agents walk around, execute tasks, and can be monitored in real-time. Think of it as a visual command center for your autonomous agent swarm.

### Features

**3D Office**
- Isometric Three.js office with desks, monitors, meeting table, couches, ping pong table, server racks, and plants
- Beige floor with gray walls, glowing monitor screens, and LED server indicators

**6 AI Agents**
- Voxel-style characters with full faces (eyes, eyebrows, nose, mouth), unique hairstyles, and colored uniforms
- Walk animations with limb swinging, idle breathing, and collision avoidance
- Agents navigate around furniture and each other with AABB collision detection

**Camera Controls**
- Left-drag: Pan the view
- Right-drag: Rotate horizontally + vertically
- Scroll: Zoom in/out (range 3–50)
- Click agent: Follow with smooth camera tracking
- Camera preset buttons (reset, front, isometric)

**UI Panels**
- **OPEN HQ** — Headquarters panel with Inbox, History, and Playbooks tabs. Monitor agent outputs, view run history, and launch reusable workflow templates
- **CHAT** — Per-agent chat interface with conversation history, model selector (GPT-4.1 mini, GPT-4o, Claude Sonnet, Llama 3, DeepSeek), and new session reset
- **MARKETPLACE** — Coming soon
- **ANALYTICS** — Coming soon

**UI Elements**
- Top bar: "0xMerl HEADQUARTERS" with agent roster chips
- Bottom-left: Connection status, working/idle counts, controls hint
- Bottom-right: Floating CHAT button
- Top-left: Camera angle controls
- Top-right: Book, edit, volume icons
- Right edge: Vertical tab buttons with slide-out panels

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/0xMer199/0xmerl-hq.git
cd 0xmerl-hq
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000`

### Build

```bash
npm run build
```

Output goes to `dist/`

## Project Structure

```
0xmerl-hq/
├── index.html              # Entry HTML
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite configuration
├── LICENSE                 # MIT License
├── .gitignore
├── public/                 # Static assets
└── src/
    ├── main.jsx            # React entry point
    ├── components/
    │   └── ClawHQ.jsx      # Main HQ component (3D scene + UI)
    ├── data/               # Agent configs, templates (future)
    └── utils/              # Helpers, collision, camera (future)
```

## Tech Stack

- **React 18** — UI framework
- **Three.js** — 3D rendering engine
- **Vite** — Build tool & dev server

## Roadmap

- [ ] Wire up real OpenClaw/ElizaOS agent backends
- [ ] Solana RPC integration for live wallet balances & tx execution
- [ ] WebSocket backend for real-time agent state
- [ ] Agent sitting animations (desk + meeting chairs)
- [ ] L-shaped office layout with separate meeting room
- [ ] Marketplace panel — browse and install agent skills
- [ ] Analytics panel — charts, metrics, performance dashboards
- [ ] Day/night cycle lighting
- [ ] Particle effects on task completion
- [ ] Sound effects and ambient office audio

## Agents

| Name     | Role             | Color   |
|----------|------------------|---------|
| Alpha    | Trader           | 🟢 Green  |
| Bravo    | DeFi Strategist  | 🟣 Purple |
| Charlie  | Data Analyst     | 🔵 Cyan   |
| Delta    | NFT Scout        | 🔴 Red    |
| Echo     | Tx Executor      | 🟡 Orange |
| Foxtrot  | Market Monitor   | 🩷 Pink   |

## Contributing

Pull requests welcome. For major changes, open an issue first.

## License

[MIT](LICENSE)

---

Built by [@solgoodmanx\_](https://x.com/solgoodmanx_) | [GitHub](https://github.com/0xMer199)
