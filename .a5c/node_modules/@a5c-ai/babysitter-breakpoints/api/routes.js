"use strict";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { openDb, run, get, all, initDb } = require("./db");
const extensions = require("../extensions");
const { listExtensions } = extensions;
const {
  listConfigs,
  getConfig,
  upsertConfig,
  parseConfig,
} = require("../extensions/config");

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

function requireToken(expected) {
  return (req, res, next) => {
    if (!expected) return next();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    if (token !== expected) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  };
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function serializeTags(tags) {
  if (!tags || !tags.length) return null;
  return JSON.stringify(tags);
}

function deserializeTags(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function repoRoot() {
  return process.env.REPO_ROOT || path.join(__dirname, "..");
}

function normalizeContextFiles(payload) {
  const context = payload?.context || {};
  if (Array.isArray(context.files)) {
    return context.files
      .filter((item) => item && typeof item.path === "string")
      .map((item) => ({
        path: item.path,
        format: item.format || null,
        language: item.language || null,
        label: item.label || null,
      }));
  }
  if (Array.isArray(context.paths)) {
    return context.paths
      .filter((item) => typeof item === "string")
      .map((item) => ({ path: item, format: null, language: null, label: null }));
  }
  return [];
}

function allowlistedExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    ".md",
    ".txt",
    ".json",
    ".js",
    ".ts",
    ".css",
    ".html",
    ".yml",
    ".yaml",
    ".sql",
    ".ps1",
    ".sh",
  ].includes(ext);
}

function resolveContextPath(requestedPath) {
  const root = repoRoot();
  const rootResolved = path.resolve(root);
  const resolved = path.resolve(root, requestedPath);
  const rootWithSep = rootResolved.endsWith(path.sep)
    ? rootResolved
    : `${rootResolved}${path.sep}`;
  if (!resolved.startsWith(rootWithSep) && resolved !== rootResolved) {
    return null;
  }
  return resolved;
}

function inferFormat(filePath, hint) {
  if (hint === "markdown" || hint === "code") return hint;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".md") return "markdown";
  return "code";
}

function inferLanguage(filePath, hint) {
  if (hint) return hint;
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".js": "javascript",
    ".ts": "typescript",
    ".json": "json",
    ".css": "css",
    ".html": "html",
    ".md": "markdown",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".sql": "sql",
    ".ps1": "powershell",
    ".sh": "bash",
    ".txt": "plaintext",
  };
  return map[ext] || "plaintext";
}

async function withDb(fn) {
  const db = openDb();
  try {
    await initDb(db);
    return await fn(db);
  } finally {
    db.close();
  }
}

const requireAgent = requireToken(process.env.AGENT_TOKEN);
const requireHuman = requireToken(process.env.HUMAN_TOKEN);

router.post("/breakpoints", requireAgent, async (req, res) => {
  const { agentId, runId, title, payload, tags, ttlSeconds } = req.body || {};
  if (!agentId || payload === undefined) {
    return res.status(400).json({ error: "agentId and payload are required" });
  }
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const tagList = parseTags(tags);
  const payloadJson = JSON.stringify(payload);
  const tagsJson = serializeTags(tagList);
  await withDb(async (db) => {
    await run(
      db,
      `INSERT INTO breakpoints
        (id, status, agent_id, run_id, title, payload, tags, ttl_seconds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        "waiting",
        agentId,
        runId || null,
        title || null,
        payloadJson,
        tagsJson,
        ttlSeconds || null,
        createdAt,
        createdAt,
      ]
    );
    await run(
      db,
      `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        id,
        "created",
        agentId,
        createdAt,
        JSON.stringify({ tags: tagList, ttlSeconds: ttlSeconds || null }),
      ]
    );
    if (ttlSeconds) {
      const runAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const jobPayload = JSON.stringify({ breakpointId: id });
      await run(
        db,
        `INSERT INTO jobs (id, type, status, payload, run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), "expire", "pending", jobPayload, runAt, createdAt, createdAt]
      );
    }
  });
  await withDb(async (db) => {
    await extensions.dispatch("onBreakpointCreated", db, {
      id,
      title,
      payload,
    });
  });
  return res.json({ breakpointId: id, status: "waiting", createdAt });
});

router.get("/breakpoints", requireHuman, async (req, res) => {
  const { status, tag, agentId, limit = "50", offset = "0" } = req.query;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
  const offsetNum = parseInt(offset, 10) || 0;
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (agentId) {
    clauses.push("agent_id = ?");
    params.push(agentId);
  }
  if (tag) {
    clauses.push("tags LIKE ?");
    params.push(`%\"${tag}\"%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await withDb((db) =>
    all(
      db,
      `SELECT * FROM breakpoints ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offsetNum]
    )
  );
  const items = rows.map((row) => ({
    id: row.id,
    status: row.status,
    agentId: row.agent_id,
    runId: row.run_id,
    title: row.title,
    tags: deserializeTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return res.json({ items });
});

router.get("/breakpoints/:id", async (req, res) => {
  const { id } = req.params;
  const row = await withDb((db) =>
    get(db, "SELECT * FROM breakpoints WHERE id = ?", [id])
  );
  if (!row) return res.status(404).json({ error: "not_found" });
  const feedback = await withDb((db) =>
    all(
      db,
      "SELECT * FROM feedback WHERE breakpoint_id = ? ORDER BY created_at ASC",
      [id]
    )
  );
  return res.json({
    breakpointId: row.id,
    status: row.status,
    agentId: row.agent_id,
    runId: row.run_id,
    title: row.title,
    payload: JSON.parse(row.payload),
    tags: deserializeTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    releasedAt: row.released_at,
    expiredAt: row.expired_at,
    cancelledAt: row.cancelled_at,
    feedback: feedback.map((item) => ({
      id: item.id,
      author: item.author,
      comment: item.comment,
      createdAt: item.created_at,
    })),
  });
});

router.get("/breakpoints/:id/status", async (req, res) => {
  const { id } = req.params;
  const row = await withDb((db) =>
    get(db, "SELECT status, updated_at FROM breakpoints WHERE id = ?", [id])
  );
  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json({ status: row.status, updatedAt: row.updated_at });
});

router.get("/breakpoints/:id/context", requireHuman, async (req, res) => {
  const { id } = req.params;
  const requestedPath = req.query.path;
  if (!requestedPath || typeof requestedPath !== "string") {
    return res.status(400).json({ error: "path query param required" });
  }
  const row = await withDb((db) =>
    get(db, "SELECT payload FROM breakpoints WHERE id = ?", [id])
  );
  if (!row) return res.status(404).json({ error: "not_found" });
  let payload;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const files = normalizeContextFiles(payload);
  const match = files.find((file) => file.path === requestedPath);
  if (!match) return res.status(403).json({ error: "path_not_allowed" });
  const resolved = resolveContextPath(requestedPath);
  if (!resolved) return res.status(403).json({ error: "path_not_allowed" });
  if (!allowlistedExtension(resolved)) {
    return res.status(403).json({ error: "extension_not_allowed" });
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return res.status(404).json({ error: "file_not_found" });
  }
  if (!stat.isFile()) {
    return res.status(400).json({ error: "not_a_file" });
  }
  const content = fs.readFileSync(resolved, "utf8");
  const format = inferFormat(resolved, match.format);
  const language = inferLanguage(resolved, match.language);
  return res.json({
    path: requestedPath,
    format,
    language,
    content,
  });
});

router.post("/breakpoints/:id/cancel", requireAgent, async (req, res) => {
  const { id } = req.params;
  const actor = req.body?.actor || "agent";
  const ts = nowIso();
  const updated = await withDb(async (db) => {
    const row = await get(db, "SELECT status FROM breakpoints WHERE id = ?", [id]);
    if (!row) return null;
    if (row.status !== "waiting") return row.status;
    await run(
      db,
      `UPDATE breakpoints
       SET status = ?, cancelled_at = ?, updated_at = ?
       WHERE id = ?`,
      ["cancelled", ts, ts, id]
    );
    await run(
      db,
      `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, "cancelled", actor, ts, null]
    );
    return "cancelled";
  });
  if (!updated) return res.status(404).json({ error: "not_found" });
  return res.json({ status: updated });
});

router.post("/breakpoints/:id/feedback", requireHuman, async (req, res) => {
  const { id } = req.params;
  const { comment, release, author } = req.body || {};
  if (!comment || !author) {
    return res.status(400).json({ error: "comment and author are required" });
  }
  const ts = nowIso();
  const result = await withDb(async (db) => {
    const row = await get(db, "SELECT status FROM breakpoints WHERE id = ?", [id]);
    if (!row) return null;
    await run(
      db,
      `INSERT INTO feedback (id, breakpoint_id, author, comment, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, author, comment, ts]
    );
    await run(
      db,
      `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, "feedback", author, ts, null]
    );
    if (release && row.status === "waiting") {
      await run(
        db,
        `UPDATE breakpoints
         SET status = ?, released_at = ?, updated_at = ?
         WHERE id = ?`,
        ["released", ts, ts, id]
      );
      await run(
        db,
        `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), id, "released", author, ts, null]
      );
      await extensions.dispatch("onBreakpointReleased", db, {
        id,
        title: id,
        payload: {},
      });
      return "released";
    }
    return row.status;
  });
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json({ status: result });
});

router.get("/extensions", requireHuman, async (req, res) => {
  const rows = await withDb((db) => listConfigs(db));
  const known = listExtensions();
  const byName = new Map(rows.map((row) => [row.name, parseConfig(row)]));
  const items = known.map((name) => {
    const existing = byName.get(name);
    if (existing) return existing;
    return {
      name,
      enabled: false,
      config: {},
      createdAt: null,
      updatedAt: null,
    };
  });
  return res.json({ items, known });
});

router.post("/extensions/:name", requireHuman, async (req, res) => {
  const { name } = req.params;
  if (!listExtensions().includes(name)) {
    return res.status(404).json({ error: "unknown_extension" });
  }
  const { enabled, config } = req.body || {};
  await withDb((db) => upsertConfig(db, name, Boolean(enabled), config || {}));
  const row = await withDb((db) => getConfig(db, name));
  return res.json({ item: parseConfig(row) });
});


router.post("/breakpoints/:id/expire", requireHuman, async (req, res) => {
  const { id } = req.params;
  const actor = req.body?.actor || "system";
  const ts = nowIso();
  const updated = await withDb(async (db) => {
    const row = await get(db, "SELECT status FROM breakpoints WHERE id = ?", [id]);
    if (!row) return null;
    if (row.status !== "waiting") return row.status;
    await run(
      db,
      `UPDATE breakpoints
       SET status = ?, expired_at = ?, updated_at = ?
       WHERE id = ?`,
      ["expired", ts, ts, id]
    );
    await run(
      db,
      `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, "expired", actor, ts, null]
    );
    return "expired";
  });
  if (!updated) return res.status(404).json({ error: "not_found" });
  return res.json({ status: updated });
});

module.exports = router;
