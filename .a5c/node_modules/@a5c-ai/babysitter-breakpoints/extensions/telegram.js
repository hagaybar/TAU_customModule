"use strict";

const https = require("https");
const crypto = require("crypto");
const { get, run } = require("../api/db");
const { upsertConfig } = require("./config");

function apiBase(token) {
  return `https://api.telegram.org/bot${token}`;
}

function callTelegram(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function sendMessage(token, chatId, text, parseMode) {
  const mode = parseMode ? `&parse_mode=${encodeURIComponent(parseMode)}` : "";
  const url = `${apiBase(token)}/sendMessage?chat_id=${encodeURIComponent(
    chatId
  )}&text=${encodeURIComponent(text)}${mode}`;
  return callTelegram(url);
}

async function sendDocument(token, chatId, filename, content) {
  const boundary = `----bp-${Date.now()}`;
  const payload = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="chat_id"`,
    "",
    String(chatId),
    `--${boundary}`,
    `Content-Disposition: form-data; name="document"; filename="${filename}"`,
    "Content-Type: text/plain",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const url = `${apiBase(token)}/sendDocument`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": Buffer.byteLength(payload),
      },
    });
    req.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function allowlistedExtension(filePath) {
  const ext = require("path").extname(filePath).toLowerCase();
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

function resolveRepoPath(requestedPath) {
  const path = require("path");
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, requestedPath);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!resolved.startsWith(rootWithSep) && resolved !== root) {
    return null;
  }
  return resolved;
}

async function readContextFile(db, breakpointId, requestedPath) {
  const row = await get(db, "SELECT payload FROM breakpoints WHERE id = ?", [
    breakpointId,
  ]);
  if (!row) return null;
  let payload;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return null;
  }
  const files = payload?.context?.files || [];
  const match = files.find((file) => file.path === requestedPath);
  if (!match) return null;
  const abs = resolveRepoPath(requestedPath);
  const fs = require("fs");
  if (!abs || !allowlistedExtension(abs) || !fs.existsSync(abs)) return null;
  return {
    filename: require("path").basename(requestedPath),
    language: match.language || null,
    content: fs.readFileSync(abs, "utf8"),
  };
}

async function listContextFiles(db, breakpointId) {
  const row = await get(db, "SELECT payload FROM breakpoints WHERE id = ?", [
    breakpointId,
  ]);
  if (!row) return [];
  let payload;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return [];
  }
  return payload?.context?.files || [];
}

async function validateToken(token) {
  const url = `${apiBase(token)}/getMe`;
  const response = await callTelegram(url);
  if (!response.ok) {
    return { error: "invalid_token" };
  }
  return { ok: true };
}

async function resolveTelegramUser(token, username) {
  const validation = await validateToken(token);
  if (!validation.ok) {
    return { error: validation.error };
  }
  const url = `${apiBase(token)}/getUpdates`;
  const response = await callTelegram(url);
  if (!response.ok) {
    return { error: "telegram_api_error" };
  }
  const updates = response.result || [];
  const lower = String(username).toLowerCase().replace(/^@/, "");
  const match = updates
    .map((update) => update.message)
    .filter(Boolean)
    .reverse()
    .find((message) => {
      const from = message.from;
      if (!from || !from.username) return false;
      return from.username.toLowerCase() === lower;
    });
  if (!match) {
    return { error: "user_not_found" };
  }
  return {
    chatId: match.chat?.id,
    userId: match.from?.id,
    username: match.from?.username,
  };
}

const sessionCache = new Map();

function cacheKey(token, username) {
  return `${token}:${String(username).toLowerCase()}`;
}

function rememberUser(token, username, chatId, userId) {
  if (!token || !username || !chatId || !userId) return;
  sessionCache.set(cacheKey(token, username), { chatId, userId });
}

function lookupUser(token, username) {
  if (!token || !username) return null;
  return sessionCache.get(cacheKey(token, username)) || null;
}

function readStoredUser(config) {
  if (!config) return null;
  if (config.chatId && config.allowedUserId) {
    return { chatId: config.chatId, userId: config.allowedUserId };
  }
  return null;
}

async function persistUser(db, config, chatId, userId) {
  if (!chatId || !userId) return;
  await upsertConfig(db, "telegram", true, {
    ...config,
    chatId,
    allowedUserId: userId,
  });
}

async function onBreakpointCreated(db, breakpoint, config) {
  if (!config?.token || !config?.username) return;
  const summary = breakpoint.title || "Untitled";
  const question = breakpoint.payload?.question || "No question provided.";
  const files = breakpoint.payload?.context?.files || [];
  const fileLines = files.length
    ? files
        .map((file, index) => {
          const format = file.format || "code";
          const label = file.label || file.path || "unknown";
          return `${index + 1}. ${label} (${format})`;
        })
        .join("\n")
    : "None";
  const text = [
    "🟠 Breakpoint waiting",
    "",
    `Title: ${summary}`,
    `ID: ${breakpoint.id}`,
    "",
    "Question:",
    question,
    "",
    "Context files:",
    fileLines,
    "",
    "Reply with any message to release.",
    "Send: file <path> or file <number> to receive a context file.",
  ].join("\n");
  const cached = lookupUser(config.token, config.username);
  const stored = readStoredUser(config);
  const target = cached?.chatId ? cached : stored;
  if (target?.chatId) {
    await sendMessage(config.token, target.chatId, text);
    return;
  }
  if (process.env.TELEGRAM_DEBUG === "1") {
    console.log("[telegram] dispatch skipped: no chatId cached/stored");
  }
}

async function onBreakpointReleased(db, breakpoint, config) {
  if (!config?.token || !config?.username) return;
  const summary = breakpoint.title || "Untitled";
  const text = [
    "✅ Breakpoint released",
    "",
    `Title: ${summary}`,
    `ID: ${breakpoint.id}`,
  ].join("\n");
  const cached = lookupUser(config.token, config.username);
  const stored = readStoredUser(config);
  const target = cached?.chatId ? cached : stored;
  if (target?.chatId) {
    await sendMessage(config.token, target.chatId, text);
    return;
  }
  if (process.env.TELEGRAM_DEBUG === "1") {
    console.log("[telegram] release notice skipped: no chatId cached/stored");
  }
}

function escapeMarkdownV2(text) {
  return text.replace(/([_\\*\\[\\]()~`>#+\\-=|{}.!])/g, "\\$1");
}

function escapeCodeBlock(text) {
  return text.replace(/[`\\]/g, "\\$&");
}

function inferLanguageFromPath(filePath) {
  const ext = require("path").extname(filePath).toLowerCase();
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
  };
  return map[ext] || "";
}

function buildRawMessage(file, originalPath) {
  const language = file.language || inferLanguageFromPath(originalPath);
  const header = `*${escapeMarkdownV2(file.filename)}*`;
  const maxLen = 2000;
  let body = file.content || "";
  if (body.length > maxLen) {
    body = `${body.slice(0, maxLen)}\n... (truncated)`;
  }
  const escaped = escapeCodeBlock(body);
  return `${header}\n\n\`\`\`${language}\n${escaped}\n\`\`\``;
}

async function poll(db, config) {
  if (!config?.token || !config?.username) {
    if (process.env.TELEGRAM_DEBUG === "1") {
      console.log(
        `[telegram] missing config token=${Boolean(
          config?.token
        )} username=${Boolean(config?.username)}`
      );
    }
    return;
  }
  const offset = config.lastUpdateId ? Number(config.lastUpdateId) + 1 : 0;
  const url = `${apiBase(
    config.token
  )}/getUpdates?offset=${offset}&allowed_updates=message,edited_message`;
  if (process.env.TELEGRAM_DEBUG === "1") {
    console.log(`[telegram] requesting updates offset=${offset}`);
  }
  const response = await callTelegram(url);
  if (!response.ok) {
    if (process.env.TELEGRAM_DEBUG === "1") {
      console.log(
        `[telegram] getUpdates failed: ${response.description || "unknown"}`
      );
    }
    return;
  }
  const updates = response.result || [];
  if (process.env.TELEGRAM_DEBUG === "1") {
    console.log(
      `[telegram] polled updates=${updates.length} offset=${offset}`
    );
  }
  let maxUpdateId = config.lastUpdateId || 0;
  for (const update of updates) {
    if (typeof update.update_id === "number") {
      maxUpdateId = Math.max(maxUpdateId, update.update_id);
    }
    const message = update.message;
    if (!message?.text) continue;
    const username = message.from?.username;
    const replyText = message.reply_to_message?.text || "";
    const replyMatch = replyText.match(/ID:\s*(\S+)/i);
    const allowByReply =
      Boolean(replyMatch) && Boolean(message.reply_to_message?.from?.is_bot);
    const normalized = String(config.username)
      .toLowerCase()
      .replace(/^@/, "");
    const usernameLower = username ? username.toLowerCase() : "";
    if (!allowByReply && usernameLower && usernameLower !== normalized) {
      if (process.env.TELEGRAM_DEBUG === "1") {
        console.log(`[telegram] skipped message from user ${username}`);
      }
      continue;
    }
    if (!allowByReply && !usernameLower) {
      if (process.env.TELEGRAM_DEBUG === "1") {
        console.log("[telegram] skipped message with no username");
      }
      continue;
    }
    if (message.chat?.id && message.from?.id) {
      rememberUser(
        config.token,
        config.username,
        message.chat.id,
        message.from.id
      );
      await persistUser(db, config, message.chat.id, message.from.id);
    }
    const trimmed = message.text.trim();
    if (trimmed.startsWith("/")) {
      if (message.chat?.id && message.from?.id) {
        rememberUser(
          config.token,
          config.username,
          message.chat.id,
          message.from.id
        );
        await persistUser(db, config, message.chat.id, message.from.id);
        if (config.token) {
          await sendMessage(
            config.token,
            message.chat.id,
            "Telegram connected. I will notify you about breakpoints here."
          );
        }
      }
      if (process.env.TELEGRAM_DEBUG === "1") {
        console.log(`[telegram] command ignored for release: ${trimmed}`);
      }
      continue;
    }
    const fileMatch = trimmed.match(/^(file|raw)\s+(.+)$/i);
    if (fileMatch) {
      const mode = fileMatch[1].toLowerCase();
      const requestedArg = fileMatch[2].trim();
      let targetId = replyMatch ? replyMatch[1] : null;
      if (!targetId) {
        const uuidMatch = trimmed.match(/[a-f0-9-]{36}/i);
        if (uuidMatch) targetId = uuidMatch[0];
      }
      if (!targetId) {
        const waiting = await new Promise((resolve, reject) => {
          db.all(
            "SELECT id, created_at FROM breakpoints WHERE status = ? ORDER BY created_at DESC",
            ["waiting"],
            (err, rows) => {
              if (err) return reject(err);
              resolve(rows || []);
            }
          );
        });
        if (waiting.length) {
          targetId = waiting[0].id;
        }
      }
      let file = null;
      if (targetId) {
        const indexMatch = requestedArg.match(/^(\d+)$/);
        if (indexMatch) {
          const files = await listContextFiles(db, targetId);
          const idx = Number(indexMatch[1]) - 1;
          if (idx >= 0 && idx < files.length) {
            const pathValue = files[idx].path;
            file = await readContextFile(db, targetId, pathValue);
            if (file) {
              file.originalPath = pathValue;
            }
          }
        } else {
          file = await readContextFile(db, targetId, requestedArg);
          if (file) {
            file.originalPath = requestedArg;
          }
        }
      }
      if (file && message.chat?.id) {
        if (mode === "raw") {
          const text = buildRawMessage(file, file.originalPath || "");
          const result = await sendMessage(
            config.token,
            message.chat.id,
            text,
            "MarkdownV2"
          );
          if (!result?.ok) {
            await sendDocument(
              config.token,
              message.chat.id,
              file.filename,
              file.content
            );
          }
        } else {
          await sendDocument(
            config.token,
            message.chat.id,
            file.filename,
            file.content
          );
        }
      } else if (message.chat?.id) {
        await sendMessage(
          config.token,
          message.chat.id,
          `File not found or not allowed: ${requestedArg}`
        );
      }
      continue;
    }
    let id = null;
    const comment = trimmed || "Released via Telegram";
    const uuidMatch = trimmed.match(/[a-f0-9-]{36}/i);
    if (replyMatch) {
      id = replyMatch[1];
    } else if (uuidMatch) {
      id = uuidMatch[0];
    } else {
      const waiting = await new Promise((resolve, reject) => {
        db.all(
          "SELECT id, created_at FROM breakpoints WHERE status = ? ORDER BY created_at DESC",
          ["waiting"],
          (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });
      if (waiting.length === 1) {
        id = waiting[0].id;
      } else if (waiting.length > 1) {
        id = waiting[0].id;
      }
    }
    if (!id) {
      if (process.env.TELEGRAM_DEBUG === "1") {
        console.log(`[telegram] no breakpoint id in message: ${trimmed}`);
      }
      continue;
    }
    const row = await get(db, "SELECT status FROM breakpoints WHERE id = ?", [
      id,
    ]);
    if (!row || row.status !== "waiting") {
      if (process.env.TELEGRAM_DEBUG === "1") {
        console.log(
          `[telegram] breakpoint ${id} not found or not waiting`
        );
      }
      continue;
    }
    const ts = new Date().toISOString();
    await run(
      db,
      `UPDATE breakpoints
       SET status = ?, released_at = ?, updated_at = ?
       WHERE id = ?`,
      ["released", ts, ts, id]
    );
    await run(
      db,
      `INSERT INTO feedback (id, breakpoint_id, author, comment, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        id,
        message.from?.username
          ? `telegram:${message.from.username}`
          : "telegram",
        comment,
        ts,
      ]
    );
    await run(
      db,
      `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        id,
        "released",
        "telegram",
        ts,
        JSON.stringify({ source: "telegram" }),
      ]
    );
    if (config.token) {
      const ack = [
        "✅ Breakpoint released",
        "",
        `ID: ${id}`,
        "",
        "Feedback:",
        comment,
      ].join("\n");
      const ackChatId =
        message.chat?.id ||
        lookupUser(config.token, config.username)?.chatId ||
        readStoredUser(config)?.chatId;
      if (ackChatId) {
        const ackResult = await sendMessage(config.token, ackChatId, ack);
        if (process.env.TELEGRAM_DEBUG === "1") {
          console.log(
            `[telegram] ack sent ok=${ackResult?.ok} chatId=${ackChatId}`
          );
        }
      }
    }
  }
  if (maxUpdateId !== config.lastUpdateId) {
    await upsertConfig(db, "telegram", true, {
      ...config,
      lastUpdateId: maxUpdateId,
    });
  }
}

module.exports = {
  onBreakpointCreated,
  onBreakpointReleased,
  poll,
};
