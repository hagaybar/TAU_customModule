"use strict";

const { listConfigs, parseConfig } = require("./config");
const telegram = require("./telegram");

const registry = {
  telegram,
};

function listExtensions() {
  return Object.keys(registry);
}

async function loadEnabledConfigs(db) {
  const rows = await listConfigs(db);
  const configs = rows.map(parseConfig).filter(Boolean);
  return configs.filter((cfg) => cfg.enabled && registry[cfg.name]);
}

async function dispatch(event, db, breakpoint) {
  const configs = await loadEnabledConfigs(db);
  for (const cfg of configs) {
    const extension = registry[cfg.name];
    if (!extension || typeof extension[event] !== "function") {
      continue;
    }
    await extension[event](db, breakpoint, cfg.config);
  }
}

async function poll(db) {
  const configs = await loadEnabledConfigs(db);
  for (const cfg of configs) {
    const extension = registry[cfg.name];
    if (!extension || typeof extension.poll !== "function") {
      continue;
    }
    await extension.poll(db, cfg.config);
  }
}

module.exports = {
  listExtensions,
  dispatch,
  poll,
};
