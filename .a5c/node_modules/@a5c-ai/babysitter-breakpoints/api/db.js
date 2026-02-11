"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const sqlite3 = require("sqlite3");

function defaultDbPath() {
  const home = os.homedir();
  return path.join(home, ".a5c", "breakpoints", "db", "breakpoints.db");
}

function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), value.slice(2));
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function resolveDbPath(value) {
  const expanded = expandHome(value);
  if (!expanded) return expanded;
  const normalized = path.normalize(expanded);
  if (normalized.endsWith(path.sep)) {
    return path.join(normalized, "breakpoints.db");
  }
  if (!path.extname(normalized)) {
    return path.join(normalized, "breakpoints.db");
  }
  return normalized;
}

const DB_PATH = resolveDbPath(process.env.DB_PATH || defaultDbPath());

function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb(db) {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  await run(db, "PRAGMA foreign_keys = ON;");
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length);
  for (const statement of statements) {
    await run(db, statement);
  }
}

module.exports = {
  DB_PATH,
  openDb,
  run,
  get,
  all,
  initDb,
};
