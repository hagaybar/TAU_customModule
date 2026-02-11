"use strict";

const crypto = require("crypto");
const { get, all, run } = require("../api/db");

async function claimJobs(db, limit) {
  const now = new Date().toISOString();
  const jobs = await all(
    db,
    `SELECT * FROM jobs
     WHERE status = 'pending' AND run_at <= ?
     ORDER BY run_at ASC
     LIMIT ?`,
    [now, limit]
  );
  for (const job of jobs) {
    await run(
      db,
      `UPDATE jobs SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'pending'`,
      [now, job.id]
    );
  }
  return jobs;
}

async function completeJob(db, jobId) {
  const now = new Date().toISOString();
  await run(
    db,
    `UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?`,
    [now, jobId]
  );
}

async function failJob(db, jobId, error) {
  const now = new Date().toISOString();
  await run(
    db,
    `UPDATE jobs SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`,
    [String(error), now, jobId]
  );
}

async function expireBreakpoint(db, breakpointId) {
  const now = new Date().toISOString();
  const row = await get(
    db,
    "SELECT status FROM breakpoints WHERE id = ?",
    [breakpointId]
  );
  if (!row) return;
  if (row.status !== "waiting") return;
  await run(
    db,
    `UPDATE breakpoints
     SET status = 'expired', expired_at = ?, updated_at = ?
     WHERE id = ?`,
    [now, now, breakpointId]
  );
  await run(
    db,
    `INSERT INTO events (id, breakpoint_id, type, actor, timestamp, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), breakpointId, "expired", "system", now, null]
  );
}

async function processJob(db, job) {
  const payload = JSON.parse(job.payload || "{}");
  if (job.type === "expire") {
    await expireBreakpoint(db, payload.breakpointId);
    return;
  }
  if (job.type === "notify") {
    return;
  }
  throw new Error(`unknown job type: ${job.type}`);
}

module.exports = {
  claimJobs,
  completeJob,
  failJob,
  processJob,
};
