"use strict";

const { get, run, all } = require("../api/db");

async function listConfigs(db) {
  return all(db, "SELECT * FROM extensions_config ORDER BY name ASC");
}

async function getConfig(db, name) {
  return get(db, "SELECT * FROM extensions_config WHERE name = ?", [name]);
}

async function upsertConfig(db, name, enabled, config) {
  const now = new Date().toISOString();
  const configJson = JSON.stringify(config || {});
  await run(
    db,
    `INSERT INTO extensions_config (name, enabled, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, config_json = excluded.config_json, updated_at = excluded.updated_at`,
    [name, enabled ? 1 : 0, configJson, now, now]
  );
}

function parseConfig(row) {
  if (!row) return null;
  let config = {};
  try {
    config = JSON.parse(row.config_json || "{}");
  } catch {
    config = {};
  }
  return {
    name: row.name,
    enabled: Boolean(row.enabled),
    config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  listConfigs,
  getConfig,
  upsertConfig,
  parseConfig,
};
