-- SQLite schema for breakpoint manager

CREATE TABLE IF NOT EXISTS breakpoints (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  run_id TEXT,
  title TEXT,
  payload TEXT NOT NULL,
  tags TEXT,
  ttl_seconds INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  released_at TEXT,
  expired_at TEXT,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  breakpoint_id TEXT NOT NULL,
  author TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (breakpoint_id) REFERENCES breakpoints(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  breakpoint_id TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (breakpoint_id) REFERENCES breakpoints(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  run_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extensions_config (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_breakpoints_status ON breakpoints(status);
CREATE INDEX IF NOT EXISTS idx_breakpoints_agent ON breakpoints(agent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON jobs(status, run_at);
