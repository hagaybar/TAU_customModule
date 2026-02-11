"use strict";

const { spawn } = require("child_process");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const defaultEnv = {
  DB_PATH:
    process.env.DB_PATH ||
    path.join(
      require("os").homedir(),
      ".a5c",
      "breakpoints",
      "db",
      "breakpoints.db"
    ),
  PORT: process.env.PORT || "3185",
  WEB_PORT: process.env.WEB_PORT || "3184",
  REPO_ROOT: process.env.REPO_ROOT || process.cwd(),
};

function run(label, command, args) {
  const proc = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...defaultEnv },
    shell: true,
    cwd: repoRoot,
  });
  proc.on("exit", (code) => {
    if (code) {
      // eslint-disable-next-line no-console
      console.error(`${label} exited with code ${code}`);
      process.exitCode = code;
    }
  });
  return proc;
}

run("api", "node", [path.join(repoRoot, "api", "server.js")]);
run("web", "node", [path.join(repoRoot, "web", "server.js")]);
run("worker", "node", [path.join(repoRoot, "worker", "worker.js")]);
