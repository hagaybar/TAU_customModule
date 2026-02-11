const tokenInput = document.getElementById("token");
const saveTokenBtn = document.getElementById("save-token");
const statusSelect = document.getElementById("status");
const tagInput = document.getElementById("tag");
const agentInput = document.getElementById("agentId");
const refreshBtn = document.getElementById("refresh");
const listEl = document.getElementById("breakpoint-list");
const listMessage = document.getElementById("list-message");
const autoRefreshSelect = document.getElementById("auto-refresh");
const notifySelect = document.getElementById("notify");
const notifyStatus = document.getElementById("notify-status");

const statWaiting = document.getElementById("stat-waiting");
const statReleased = document.getElementById("stat-released");
const statExpired = document.getElementById("stat-expired");
const statCancelled = document.getElementById("stat-cancelled");

const detailEmpty = document.getElementById("detail-empty");
const detailView = document.getElementById("detail-view");
const detailTitle = document.getElementById("detail-title");
const detailStatus = document.getElementById("detail-status");
const detailMeta = document.getElementById("detail-meta");
const detailPayload = document.getElementById("detail-payload");
const feedbackList = document.getElementById("feedback-list");
const feedbackText = document.getElementById("feedback-text");
const feedbackAuthor = document.getElementById("feedback-author");
const sendFeedbackBtn = document.getElementById("send-feedback");
const releaseBtn = document.getElementById("release");
const feedbackMessage = document.getElementById("feedback-message");
const contextList = document.getElementById("context-list");
const contextEmpty = document.getElementById("context-empty");
const contextMeta = document.getElementById("context-meta");
const contextRender = document.getElementById("context-render");
const contextCode = document.getElementById("context-code");
const contextCodeInner = document.getElementById("context-code-inner");
const extensionsMessage = document.getElementById("extensions-message");
const extensionsList = document.getElementById("extensions-list");

const STORAGE_KEY = "bp_token";
const STORAGE_REFRESH_KEY = "bp_auto_refresh";
const STORAGE_NOTIFY_KEY = "bp_notify";
let currentId = null;
let currentStatus = null;
let contextFiles = [];
let refreshTimer = null;
let lastWaitingIds = new Set();

function getToken() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

function setToken(value) {
  localStorage.setItem(STORAGE_KEY, value);
}

function getAutoRefresh() {
  return localStorage.getItem(STORAGE_REFRESH_KEY) || "10";
}

function setAutoRefresh(value) {
  localStorage.setItem(STORAGE_REFRESH_KEY, value);
}

function getNotifySetting() {
  return localStorage.getItem(STORAGE_NOTIFY_KEY) || "off";
}

function setNotifySetting(value) {
  localStorage.setItem(STORAGE_NOTIFY_KEY, value);
}

function authHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function apiBase() {
  if (window.API_BASE) return window.API_BASE;
  const host = window.location.hostname || "localhost";
  return `http://${host}:3185`;
}

function setMessage(text) {
  listMessage.textContent = text || "";
}

function updateNotifyStatus() {
  if (!notifyStatus) return;
  if (!("Notification" in window)) {
    notifyStatus.textContent = "Notifications not supported in this browser.";
    return;
  }
  if (Notification.permission === "denied") {
    notifyStatus.textContent = "Notifications blocked in browser settings.";
    return;
  }
  if (Notification.permission === "default") {
    notifyStatus.textContent = "Enable to request permission.";
    return;
  }
  notifyStatus.textContent = "Notifications enabled.";
}

async function fetchJson(url, options = {}) {
  const target = url.startsWith("http") ? url : `${apiBase()}${url}`;
  const res = await fetch(target, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function setStats(items) {
  const counts = {
    waiting: 0,
    released: 0,
    expired: 0,
    cancelled: 0,
  };
  items.forEach((item) => {
    if (counts[item.status] !== undefined) counts[item.status] += 1;
  });
  statWaiting.textContent = counts.waiting;
  statReleased.textContent = counts.released;
  statExpired.textContent = counts.expired;
  statCancelled.textContent = counts.cancelled;
}

function statusClass(status) {
  return status ? `status-pill ${status}` : "status-pill";
}

function getContextFiles(payload) {
  const context = payload?.context || {};
  if (Array.isArray(context.files)) {
    return context.files
      .filter((item) => item && typeof item.path === "string")
      .map((item) => ({
        path: item.path,
        label: item.label || item.path,
        format: item.format || null,
        language: item.language || null,
      }));
  }
  if (Array.isArray(context.paths)) {
    return context.paths
      .filter((item) => typeof item === "string")
      .map((item) => ({ path: item, label: item, format: null, language: null }));
  }
  return [];
}

function renderContextList() {
  contextList.innerHTML = "";
  contextMeta.textContent = "";
  contextRender.innerHTML = "";
  contextCodeInner.textContent = "";
  contextCode.classList.add("hidden");
  if (!contextFiles.length) {
    contextEmpty.classList.remove("hidden");
    return;
  }
  contextEmpty.classList.add("hidden");
  contextFiles.forEach((file, index) => {
    const li = document.createElement("li");
    li.className = "context-item";
    li.textContent = file.label;
    li.addEventListener("click", () => {
      document
        .querySelectorAll(".context-item")
        .forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      loadContextFile(file);
    });
    contextList.appendChild(li);
    if (index === 0) {
      li.classList.add("active");
      loadContextFile(file);
    }
  });
}

async function loadContextFile(file) {
  if (!currentId) return;
  contextMeta.textContent = `Loading ${file.path}...`;
  contextRender.innerHTML = "";
  contextCodeInner.textContent = "";
  contextCode.classList.add("hidden");
  try {
    const res = await fetchJson(
      `/api/breakpoints/${currentId}/context?path=${encodeURIComponent(file.path)}`
    );
    contextMeta.textContent = `${res.path} | ${res.format} | ${res.language}`;
    if (res.format === "markdown") {
      contextRender.innerHTML = window.marked.parse(res.content || "");
      contextCode.classList.add("hidden");
      contextRender.classList.remove("hidden");
    } else {
      contextCodeInner.textContent = res.content || "";
      contextCode.classList.remove("hidden");
      contextRender.classList.add("hidden");
      window.hljs.highlightElement(contextCodeInner);
    }
  } catch (err) {
    contextMeta.textContent = err.message;
  }
}

function renderList(items) {
  listEl.innerHTML = "";
  if (!items.length) {
    listEl.innerHTML = "<li class=\"hint\">No breakpoints found.</li>";
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "breakpoint-card";
    li.innerHTML = `
      <div><strong>${item.title || item.id}</strong></div>
      <div class="hint">${item.agentId || "unknown agent"}</div>
      <div class="hint">${item.createdAt}</div>
      <span class="${statusClass(item.status)}">${item.status}</span>
    `;
    li.addEventListener("click", () => loadDetail(item.id));
    listEl.appendChild(li);
  });
}

function renderDetail(data) {
  currentStatus = data.status;
  detailTitle.textContent = data.title || data.breakpointId;
  detailStatus.textContent = data.status;
  detailStatus.className = statusClass(data.status);
  detailMeta.textContent = `Agent: ${data.agentId || "unknown"} | Created: ${
    data.createdAt
  }`;
  detailPayload.textContent = JSON.stringify(data.payload, null, 2);
  feedbackList.innerHTML = "";
  if (!data.feedback.length) {
    feedbackList.innerHTML = "<li class=\"hint\">No feedback yet.</li>";
  } else {
    data.feedback.forEach((item) => {
      const li = document.createElement("li");
      li.className = "feedback-item";
      li.innerHTML = `<strong>${item.author}</strong><div>${item.comment}</div><div class="hint">${item.createdAt}</div>`;
      feedbackList.appendChild(li);
    });
  }
  detailEmpty.classList.add("hidden");
  detailView.classList.remove("hidden");

  if (data.status !== "waiting") {
    sendFeedbackBtn.classList.add("disabled");
    releaseBtn.classList.add("disabled");
  } else {
    sendFeedbackBtn.classList.remove("disabled");
    releaseBtn.classList.remove("disabled");
  }

  contextFiles = getContextFiles(data.payload);
  renderContextList();
}

async function loadList() {
  setMessage("Loading...");
  const params = new URLSearchParams();
  if (statusSelect.value) params.set("status", statusSelect.value);
  if (tagInput.value) params.set("tag", tagInput.value);
  if (agentInput.value) params.set("agentId", agentInput.value);
  const data = await fetchJson(`/api/breakpoints?${params.toString()}`);
  const items = data.items || [];
  updateWaitingNotifications(items);
  setStats(items);
  renderList(items);
  setMessage("");
}

function maskValue(value) {
  if (!value) return "";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

async function loadExtensions() {
  extensionsMessage.textContent = "Loading...";
  const data = await fetchJson("/api/extensions");
  const items = data.items || [];
  extensionsList.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "extension-card";
    const isEnabled = item.enabled;
    const tokenValue = item.config?.token ? maskValue(item.config.token) : "";
    if (item.name === "telegram") {
      card.innerHTML = `
        <div class="extension-header">
          <div><strong>${item.name}</strong></div>
          <div class="status-pill ${isEnabled ? "released" : "cancelled"}">
            ${isEnabled ? "enabled" : "disabled"}
          </div>
        </div>
        <div class="extension-fields">
          <div>
            <label>Bot Token</label>
            <input data-field="token" type="password" value="${tokenValue}" placeholder="Telegram bot token" />
          </div>
          <div>
            <label>User Handle</label>
            <input data-field="username" type="text" value="${item.config?.username || ""}" placeholder="@yourhandle" />
          </div>
        </div>
        <div class="extension-help">Send /start to the bot. The worker will attach chat/user IDs automatically.</div>
        <div class="extension-actions">
          <button data-action="save">Save</button>
          <button data-action="toggle">${isEnabled ? "Disable" : "Enable"}</button>
        </div>
      `;
      card.addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        const action = button.getAttribute("data-action");
        const tokenInput = card.querySelector("input[data-field='token']");
        const userInput = card.querySelector("input[data-field='username']");
        const token = tokenInput.value.trim();
        const username = userInput.value.trim();
        if (action === "save") {
          if (!token) {
            extensionsMessage.textContent = "Token required.";
            return;
          }
          const config = {
            token,
            username,
            chatId: item.config?.chatId,
            allowedUserId: item.config?.allowedUserId,
          };
          try {
            await fetchJson(`/api/extensions/telegram`, {
              method: "POST",
              body: JSON.stringify({ enabled: isEnabled, config }),
            });
            await loadExtensions();
          } catch (err) {
            extensionsMessage.textContent = err.message || "Save failed.";
          }
          return;
        }
        if (action === "toggle") {
          await fetchJson(`/api/extensions/telegram`, {
            method: "POST",
            body: JSON.stringify({
              enabled: !isEnabled,
              config: item.config || {},
            }),
          });
          await loadExtensions();
        }
      });
    } else {
      card.innerHTML = `
        <div class="extension-header">
          <div><strong>${item.name}</strong></div>
          <div class="status-pill ${isEnabled ? "released" : "cancelled"}">
            ${isEnabled ? "enabled" : "disabled"}
          </div>
        </div>
        <div class="extension-actions">
          <button data-action="toggle">${isEnabled ? "Disable" : "Enable"}</button>
        </div>
      `;
      card.addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        await fetchJson(`/api/extensions/${item.name}`, {
          method: "POST",
          body: JSON.stringify({ enabled: !isEnabled, config: item.config || {} }),
        });
        await loadExtensions();
      });
    }
    extensionsList.appendChild(card);
  });
  extensionsMessage.textContent = "";
}

async function loadDetail(id) {
  currentId = id;
  const data = await fetchJson(`/api/breakpoints/${id}`);
  renderDetail(data);
}

async function sendFeedback(release) {
  if (!currentId) return;
  feedbackMessage.textContent = "";
  if (currentStatus !== "waiting") {
    feedbackMessage.textContent = "Breakpoint is not waiting.";
    return;
  }
  const comment = feedbackText.value.trim();
  const author = feedbackAuthor.value.trim();
  if (!comment || !author) {
    feedbackMessage.textContent = "Comment and author are required.";
    return;
  }
  await fetchJson(`/api/breakpoints/${currentId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ comment, author, release }),
  });
  feedbackText.value = "";
  await loadDetail(currentId);
}

function updateWaitingNotifications(items) {
  const waiting = items.filter((item) => item.status === "waiting");
  const waitingIds = new Set(waiting.map((item) => item.id));
  const newItems = waiting.filter((item) => !lastWaitingIds.has(item.id));
  lastWaitingIds = waitingIds;
  if (getNotifySetting() !== "on") return;
  if (!newItems.length) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  newItems.forEach((item) => {
    new Notification("New breakpoint waiting", {
      body: item.title || item.id,
    });
  });
}

function updateAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  const value = autoRefreshSelect.value;
  setAutoRefresh(value);
  if (value === "off") return;
  const intervalMs = parseInt(value, 10) * 1000;
  refreshTimer = setInterval(() => {
    loadList().catch((err) => {
      setMessage(err.message);
    });
  }, intervalMs);
}

saveTokenBtn.addEventListener("click", () => {
  setToken(tokenInput.value.trim());
});

refreshBtn.addEventListener("click", () => {
  loadList().catch((err) => {
    setMessage(err.message);
  });
});

sendFeedbackBtn.addEventListener("click", () => {
  sendFeedback(false).catch((err) => {
    feedbackMessage.textContent = err.message;
  });
});

releaseBtn.addEventListener("click", () => {
  sendFeedback(true).catch((err) => {
    feedbackMessage.textContent = err.message;
  });
});

tokenInput.value = getToken();
autoRefreshSelect.value = getAutoRefresh();
notifySelect.value = getNotifySetting();
updateAutoRefresh();
updateNotifyStatus();

autoRefreshSelect.addEventListener("change", updateAutoRefresh);

notifySelect.addEventListener("change", async () => {
  const value = notifySelect.value;
  setNotifySetting(value);
  if (value === "on" && "Notification" in window) {
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
  }
  updateNotifyStatus();
});

notifySelect.addEventListener("change", () => {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Desktop alerts enabled", {
        body: "You will be notified of new waiting breakpoints.",
      });
    }
  }
});

loadList().catch((err) => {
  setMessage(err.message);
});

loadExtensions().catch((err) => {
  extensionsMessage.textContent = err.message;
});
