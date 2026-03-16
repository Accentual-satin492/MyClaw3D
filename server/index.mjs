import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || "http://127.0.0.1:18789";
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || "main";
const OPENCLAW_AGENT_MAP_JSON = process.env.OPENCLAW_AGENT_MAP_JSON || "";

function parseAgentMap() {
  if (!OPENCLAW_AGENT_MAP_JSON.trim()) return null;
  try {
    const v = JSON.parse(OPENCLAW_AGENT_MAP_JSON);
    if (v && typeof v === "object") return v;
  } catch {
    // ignore
  }
  return null;
}

const AGENT_MAP = parseAgentMap();

if (!OPENCLAW_GATEWAY_TOKEN) {
  // Keep running so the frontend can still load; API calls will 500 with a clear message.
  console.warn("[myclaw3d] OPENCLAW_GATEWAY_TOKEN is not set. /api/chat will fail.");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

const DATA_DIR = path.join(__dirname, ".data");
const EVENTS_PATH = path.join(DATA_DIR, "events.json");
const PLAYBOOKS_PATH = path.join(DATA_DIR, "playbooks.json");
const INBOX_PATH = path.join(DATA_DIR, "inbox.json");
const AGENT_SETTINGS_PATH = path.join(DATA_DIR, "agent-settings.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFileAtomic(filePath, value) {
  const tmp = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

function nowId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

let EVENTS = [];
let PLAYBOOKS = [];
let INBOX = [];
let AGENT_SETTINGS = {};

async function loadStores() {
  await ensureDataDir();
  EVENTS = await readJsonFile(EVENTS_PATH, []);
  PLAYBOOKS = await readJsonFile(PLAYBOOKS_PATH, []);
  INBOX = await readJsonFile(INBOX_PATH, []);
  AGENT_SETTINGS = await readJsonFile(AGENT_SETTINGS_PATH, {});
  if (!Array.isArray(EVENTS)) EVENTS = [];
  if (!Array.isArray(PLAYBOOKS)) PLAYBOOKS = [];
  if (!Array.isArray(INBOX)) INBOX = [];
  if (!AGENT_SETTINGS || typeof AGENT_SETTINGS !== "object" || Array.isArray(AGENT_SETTINGS)) AGENT_SETTINGS = {};
}

function sanitizeEvent(e) {
  const safe = { ...(e && typeof e === "object" ? e : {}) };
  // Never trust/keep huge payloads.
  if (typeof safe.req === "string" && safe.req.length > 4000) safe.req = safe.req.slice(0, 4000) + "\n…";
  if (typeof safe.res === "string" && safe.res.length > 6000) safe.res = safe.res.slice(0, 6000) + "\n…";
  return safe;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    openclawBaseUrl: OPENCLAW_BASE_URL,
    openclawAgentId: OPENCLAW_AGENT_ID,
    hasToken: Boolean(OPENCLAW_GATEWAY_TOKEN),
    hasAgentSettings: Boolean(Object.keys(AGENT_SETTINGS || {}).length),
  });
});

// --- Agent settings (MyClaw3D agent -> OpenClaw agent + model) ---
app.get("/api/agent-settings", (req, res) => {
  res.json({ ok: true, settings: AGENT_SETTINGS || {} });
});

app.put("/api/agent-settings", async (req, res) => {
  try {
    const next = req.body && typeof req.body === "object" ? req.body : {};
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      return res.status(400).json({ ok: false, error: { type: "invalid_request", message: "body must be an object map" } });
    }
    AGENT_SETTINGS = next;
    await writeJsonFileAtomic(AGENT_SETTINGS_PATH, AGENT_SETTINGS);
    res.json({ ok: true, settings: AGENT_SETTINGS });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

app.post("/api/agent-settings/test", async (req, res) => {
  try {
    const { agentId, openclawAgentId, model } = req.body || {};
    if (!agentId) return res.status(400).json({ ok: false, error: { type: "invalid_request", message: "agentId is required" } });
    if (!OPENCLAW_GATEWAY_TOKEN) return res.status(500).json({ ok: false, error: { type: "server_config", message: "Server missing OPENCLAW_GATEWAY_TOKEN" } });

    const routing = resolveAgentRouting({ myclawAgentId: agentId, openclawAgentId, model });
    const routedAgentId = routing.openclawAgentId;
    const t0 = Date.now();

    const r = await fetch(`${OPENCLAW_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": routedAgentId,
      },
      body: JSON.stringify(buildChatCompletionsBody({
        model: routing.model,
        agentId,
        agentName: "Settings Test",
        agentRole: "connectivity-check",
        intent: "agent_settings_test",
        message: "Reply with exactly: OK",
        history: [],
      })),
    });

    const json = await r.json().catch(() => null);
    const text = json?.choices?.[0]?.message?.content ?? "";
    const ms = Date.now() - t0;
    if (!r.ok) return res.status(r.status).json({ ok: false, error: { type: "openclaw_error", status: r.status, details: json }, ms });
    res.json({ ok: true, ms, text, routedAgentId, model: routing.model });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

// --- Events (History/Observability) ---
app.get("/api/events", (req, res) => {
  const limit = clamp(Number(req.query.limit || 120), 1, 500);
  const sinceTs = Number(req.query.sinceTs || 0);
  const type = (req.query.type || "").toString().trim();
  const agentId = (req.query.agentId || "").toString().trim();
  const errorsOnly = req.query.errorsOnly === "1" || req.query.errorsOnly === "true";

  let rows = EVENTS;
  if (sinceTs) rows = rows.filter(e => Number(e.ts || 0) > sinceTs);
  if (type) rows = rows.filter(e => e.type === type);
  if (agentId) rows = rows.filter(e => e.agentId === agentId);
  if (errorsOnly) rows = rows.filter(e => e.ok === false);

  rows = rows.slice().sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, limit);
  res.json({ ok: true, events: rows });
});

app.post("/api/events", async (req, res) => {
  try {
    const evt = sanitizeEvent(req.body || {});
    const e = {
      id: evt.id || nowId("evt"),
      ts: typeof evt.ts === "number" ? evt.ts : Date.now(),
      type: evt.type || "event",
      agentId: evt.agentId || null,
      label: evt.label || "",
      ok: typeof evt.ok === "boolean" ? evt.ok : true,
      status: evt.status,
      error: evt.error,
      ms: evt.ms,
      inTok: evt.inTok,
      outTok: evt.outTok,
      req: evt.req,
      res: evt.res,
    };
    EVENTS.unshift(e);
    if (EVENTS.length > 2000) EVENTS = EVENTS.slice(0, 2000);
    await writeJsonFileAtomic(EVENTS_PATH, EVENTS);
    res.json({ ok: true, event: e });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

// --- Inbox ---
app.get("/api/inbox", (req, res) => {
  const limit = clamp(Number(req.query.limit || 100), 1, 500);
  const onlyOpen = req.query.onlyOpen === "1" || req.query.onlyOpen === "true";
  let rows = INBOX.slice().sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  if (onlyOpen) rows = rows.filter(x => x.status !== "done");
  res.json({ ok: true, items: rows.slice(0, limit) });
});

app.post("/api/inbox", async (req, res) => {
  try {
    const { agentId, title, body, status } = req.body || {};
    const item = {
      id: nowId("inbox"),
      ts: Date.now(),
      agentId: agentId || null,
      title: String(title || "Message"),
      body: String(body || ""),
      status: status || "open",
    };
    INBOX.unshift(item);
    if (INBOX.length > 2000) INBOX = INBOX.slice(0, 2000);
    await writeJsonFileAtomic(INBOX_PATH, INBOX);
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

app.patch("/api/inbox/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const idx = INBOX.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: { type: "not_found" } });
    const patch = req.body || {};
    INBOX[idx] = { ...INBOX[idx], ...patch, id: INBOX[idx].id, ts: INBOX[idx].ts };
    await writeJsonFileAtomic(INBOX_PATH, INBOX);
    res.json({ ok: true, item: INBOX[idx] });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

// --- Playbooks ---
app.get("/api/playbooks", (req, res) => {
  res.json({ ok: true, playbooks: PLAYBOOKS.slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) });
});

app.post("/api/playbooks", async (req, res) => {
  try {
    const b = req.body || {};
    const intervalMs = clamp(Number(b.intervalMs || 60000), 15000, 7 * 24 * 60 * 60 * 1000);
    const now = Date.now();
    const pb = {
      id: nowId("pb"),
      title: String(b.title || "PLAYBOOK"),
      desc: String(b.desc || ""),
      color: String(b.color || "#c8a050"),
      intervalMs,
      agentId: String(b.agentId || "random"),
      taskText: String(b.taskText || b.desc || b.title || "playbook run"),
      enabled: Boolean(b.enabled ?? true),
      createdAt: now,
      lastRunAt: 0,
      nextRunAt: now + 2500,
    };
    PLAYBOOKS.unshift(pb);
    await writeJsonFileAtomic(PLAYBOOKS_PATH, PLAYBOOKS);
    res.json({ ok: true, playbook: pb });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

app.patch("/api/playbooks/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const idx = PLAYBOOKS.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: { type: "not_found" } });
    const patch = req.body || {};
    const prev = PLAYBOOKS[idx];
    const next = {
      ...prev,
      ...patch,
      id: prev.id,
      createdAt: prev.createdAt,
      intervalMs: patch.intervalMs != null ? clamp(Number(patch.intervalMs), 15000, 7 * 24 * 60 * 60 * 1000) : prev.intervalMs,
    };
    PLAYBOOKS[idx] = next;
    await writeJsonFileAtomic(PLAYBOOKS_PATH, PLAYBOOKS);
    res.json({ ok: true, playbook: next });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

app.delete("/api/playbooks/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const before = PLAYBOOKS.length;
    PLAYBOOKS = PLAYBOOKS.filter(x => x.id !== id);
    if (PLAYBOOKS.length === before) return res.status(404).json({ ok: false, error: { type: "not_found" } });
    await writeJsonFileAtomic(PLAYBOOKS_PATH, PLAYBOOKS);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

function buildChatCompletionsBody({ model, agentId, agentName, agentRole, message, history, intent }) {
  const safeHistory = Array.isArray(history) ? history : [];
  const who = [agentName, agentRole].filter(Boolean).join(" — ");
  const intentLine = intent ? `Intent: ${intent}.` : "";
  return {
    model: model || "openclaw",
    user: `myclaw3d:${agentId}`,
    messages: [
      {
        role: "system",
        content:
          `You are a real autonomous agent inside MyClaw3D (a 3D world).` +
          (who ? ` Your identity: ${who}.` : "") +
          (intentLine ? ` ${intentLine}` : "") +
          ` Keep responses concise and action-oriented. When helpful, include short terminal-style lines.`,
      },
      ...safeHistory,
      { role: "user", content: message },
    ],
  };
}

function resolveAgentRouting({ myclawAgentId, openclawAgentId, model }) {
  const fromSettings = myclawAgentId && AGENT_SETTINGS && AGENT_SETTINGS[myclawAgentId];
  const mappedAgentId = openclawAgentId || fromSettings?.openclawAgentId || (AGENT_MAP && AGENT_MAP[myclawAgentId]) || OPENCLAW_AGENT_ID;
  const mappedModel = model || fromSettings?.model || "openclaw";
  return { openclawAgentId: mappedAgentId, model: mappedModel };
}

async function runPlaybookOnce(pb) {
  const now = Date.now();
  const agentId = pb.agentId && pb.agentId !== "random" ? pb.agentId : "main";
  const t0 = Date.now();
  try {
    if (!OPENCLAW_GATEWAY_TOKEN) throw new Error("missing OPENCLAW_GATEWAY_TOKEN");

    const routedAgentId = (pb.agentId && pb.agentId !== "random" && AGENT_MAP && AGENT_MAP[pb.agentId]) || OPENCLAW_AGENT_ID;
    const r = await fetch(`${OPENCLAW_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": routedAgentId,
      },
      body: JSON.stringify(buildChatCompletionsBody({
        agentId: pb.agentId && pb.agentId !== "random" ? pb.agentId : "playbook",
        agentName: "Playbook",
        agentRole: "scheduler",
        intent: "playbook",
        message: pb.taskText,
        history: [],
      })),
    });
    const json = await r.json().catch(() => null);
    const text = json?.choices?.[0]?.message?.content ?? "";
    const ok = r.ok;
    const ms = Date.now() - t0;

    const evt = {
      id: nowId("evt"),
      ts: now,
      type: "playbook",
      agentId: pb.agentId || null,
      label: `playbook: ${pb.title}`,
      ok,
      status: r.status,
      ms,
      req: `Playbook "${pb.title}"\n\n${pb.taskText}`,
      res: ok ? text : JSON.stringify(json || { status: r.status }),
    };
    EVENTS.unshift(evt);
    if (EVENTS.length > 2000) EVENTS = EVENTS.slice(0, 2000);
    await writeJsonFileAtomic(EVENTS_PATH, EVENTS);

    const inboxItem = {
      id: nowId("inbox"),
      ts: now,
      agentId: pb.agentId || null,
      title: ok ? `Playbook ran: ${pb.title}` : `Playbook failed: ${pb.title}`,
      body: ok ? text : JSON.stringify(json || { status: r.status }),
      status: "open",
    };
    INBOX.unshift(inboxItem);
    if (INBOX.length > 2000) INBOX = INBOX.slice(0, 2000);
    await writeJsonFileAtomic(INBOX_PATH, INBOX);

    return { ok, text };
  } catch (err) {
    const evt = {
      id: nowId("evt"),
      ts: now,
      type: "playbook",
      agentId: pb.agentId || null,
      label: `playbook: ${pb.title}`,
      ok: false,
      error: err?.message || String(err),
      ms: Date.now() - t0,
      req: `Playbook "${pb.title}"\n\n${pb.taskText}`,
      res: err?.message || String(err),
    };
    EVENTS.unshift(evt);
    if (EVENTS.length > 2000) EVENTS = EVENTS.slice(0, 2000);
    await writeJsonFileAtomic(EVENTS_PATH, EVENTS);
    return { ok: false };
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const { agentId, agentName, agentRole, message, history, openclawAgentId, intent, model } = req.body || {};
    if (!agentId || !message) return res.status(400).json({ error: "agentId and message are required" });
    if (!OPENCLAW_GATEWAY_TOKEN) return res.status(500).json({ error: "Server missing OPENCLAW_GATEWAY_TOKEN" });

    const routing = resolveAgentRouting({ myclawAgentId: agentId, openclawAgentId, model });
    const routedAgentId = routing.openclawAgentId;
    const r = await fetch(`${OPENCLAW_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": routedAgentId,
      },
      body: JSON.stringify(buildChatCompletionsBody({ model: routing.model, agentId, agentName, agentRole, message, history, intent })),
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) return res.status(r.status).json({ error: "openclaw_error", details: json });

    const text = json?.choices?.[0]?.message?.content ?? "";
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: err?.message || String(err) });
  }
});

// SSE passthrough: client receives OpenAI-style SSE "data: ..." lines.
app.post("/api/chat/stream", async (req, res) => {
  try {
    const { agentId, agentName, agentRole, message, history, openclawAgentId, intent, model } = req.body || {};
    if (!agentId || !message) return res.status(400).json({ error: "agentId and message are required" });
    if (!OPENCLAW_GATEWAY_TOKEN) return res.status(500).json({ error: "Server missing OPENCLAW_GATEWAY_TOKEN" });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const abort = new AbortController();
    req.on("close", () => abort.abort());

    const routing = resolveAgentRouting({ myclawAgentId: agentId, openclawAgentId, model });
    const routedAgentId = routing.openclawAgentId;
    const r = await fetch(`${OPENCLAW_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": routedAgentId,
      },
      body: JSON.stringify({ ...buildChatCompletionsBody({ model: routing.model, agentId, agentName, agentRole, message, history, intent }), stream: true }),
    });

    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => "");
      res.write(`event: error\ndata: ${JSON.stringify({ status: r.status, body: t })}\n\n`);
      res.end();
      return;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // Forward full SSE frames as we receive them.
      // Frame separator is double newline.
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx + 2);
        buf = buf.slice(idx + 2);
        res.write(frame);
      }
    }

    if (buf.trim().length) res.write(buf);
    res.end();
  } catch (err) {
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err?.message || String(err) })}\n\n`);
      res.end();
    } catch {
      // ignore
    }
  }
});

// Tools Invoke proxy: https://docs.openclaw.ai/gateway/tools-invoke-http-api.md
app.post("/api/tools/invoke", async (req, res) => {
  try {
    const { agentId, tool, action, args, sessionKey, openclawAgentId } = req.body || {};
    if (!tool) return res.status(400).json({ ok: false, error: { type: "invalid_request", message: "tool is required" } });
    if (!OPENCLAW_GATEWAY_TOKEN) return res.status(500).json({ ok: false, error: { type: "server_config", message: "Server missing OPENCLAW_GATEWAY_TOKEN" } });

    const routedAgentId = openclawAgentId || (agentId && AGENT_SETTINGS && AGENT_SETTINGS[agentId]?.openclawAgentId) || (agentId && AGENT_MAP && AGENT_MAP[agentId]) || OPENCLAW_AGENT_ID;
    const effectiveSessionKey = sessionKey || (agentId ? `myclaw3d:${agentId}` : "main");

    const r = await fetch(`${OPENCLAW_BASE_URL}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
        // Not required by docs, but helps if the gateway supports agent routing headers consistently.
        "x-openclaw-agent-id": routedAgentId,
      },
      body: JSON.stringify({
        tool,
        action,
        args: args && typeof args === "object" ? args : {},
        sessionKey: effectiveSessionKey,
      }),
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) return res.status(r.status).json(json || { ok: false, error: { type: "openclaw_error", message: `HTTP ${r.status}` } });
    res.json(json);
  } catch (err) {
    res.status(500).json({ ok: false, error: { type: "server_error", message: err?.message || String(err) } });
  }
});

// Static serving for production builds (optional).
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) res.status(404).end();
  });
});

app.listen(PORT, () => {
  console.log(`[myclaw3d] server listening on http://127.0.0.1:${PORT}`);
});

// Boot stores + scheduler
await loadStores();
setInterval(async () => {
  const now = Date.now();
  const due = PLAYBOOKS.filter(p => p && p.enabled && Number(p.nextRunAt || 0) <= now);
  if (!due.length) return;
  for (const pb of due.slice(0, 3)) {
    // Update nextRunAt immediately to avoid double fires
    const idx = PLAYBOOKS.findIndex(x => x.id === pb.id);
    if (idx !== -1) {
      PLAYBOOKS[idx] = {
        ...PLAYBOOKS[idx],
        lastRunAt: now,
        nextRunAt: now + clamp(Number(PLAYBOOKS[idx].intervalMs || 60000), 15000, 7 * 24 * 60 * 60 * 1000),
      };
    }
    try {
      await writeJsonFileAtomic(PLAYBOOKS_PATH, PLAYBOOKS);
    } catch {
      // ignore
    }
    // Execute
    runPlaybookOnce(pb).catch(() => {});
  }
}, 1000);

