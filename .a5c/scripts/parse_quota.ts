import { readdirSync, readFileSync } from "fs";
import { join } from "path";

type ClaudeJsonl = {
  timestamp?: string; // ISO, e.g. 2026-02-11T16:01:59.121Z
  error?: string; // "rate_limit"
  cwd?: string;
  message?: {
    content?: Array<{ type?: string; text?: string }>;
  };
};

type HookPayload = {
  runId?: string;
};

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function parseResetText(text: string): { hour24: number; minute: number; tz?: string } | null {
  const m =
    text.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:\(([^)]+)\))?/i) ??
    text.match(/resets\s+(\d{1,2}):(\d{2})\s*(?:\(([^)]+)\))?/i);

  if (!m) return null;

  // am/pm
  if (m.length >= 4 && (m[3]?.toLowerCase?.() === "am" || m[3]?.toLowerCase?.() === "pm")) {
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    const ampm = String(m[3]).toLowerCase();
    const tz = m[4];

    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    return { hour24: hour, minute, tz };
  }

  // 24h
  const hour24 = Number(m[1]);
  const minute = Number(m[2]);
  const tz = m[3];
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return null;
  return { hour24, minute, tz };
}

function isoToDate(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Bad ISO timestamp: ${iso}`);
  return d;
}

function secondsUntilReset(timestampIso: string, resetHour: number, resetMinute: number, tz: string): number {
  const msgUtc = isoToDate(timestampIso);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(fmt.formatToParts(msgUtc).map((p) => [p.type, p.value]));
  const y = Number(parts.year);
  const mo = Number(parts.month);
  const da = Number(parts.day);

  function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
    const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    const p = Object.fromEntries(fmt.formatToParts(guess).map((pp) => [pp.type, pp.value]));
    const zy = Number(p.year),
      zmo = Number(p.month),
      zda = Number(p.day),
      zh = Number(p.hour),
      zmin = Number(p.minute);

    const shown = Date.UTC(zy, zmo - 1, zda, zh, zmin, 0, 0);
    const intended = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const diffMs = intended - shown;
    return new Date(guess.getTime() + diffMs);
  }

  let resetUtc = zonedToUtc(y, mo, da, resetHour, resetMinute);

  if (resetUtc.getTime() <= msgUtc.getTime()) {
    const msgPlusDay = new Date(msgUtc.getTime() + 24 * 3600 * 1000);
    const p2 = Object.fromEntries(fmt.formatToParts(msgPlusDay).map((p) => [p.type, p.value]));
    resetUtc = zonedToUtc(Number(p2.year), Number(p2.month), Number(p2.day), resetHour, resetMinute);
  }

  const deltaMs = resetUtc.getTime() - msgUtc.getTime();
  return Math.max(0, Math.floor(deltaMs / 1000));
}

function findLatestRateLimitLineForCwd(cwd: string): { file: string; lineNo: number; line: string } | null {
  const home = process.env.HOME || "";
  if (!home) return null;

  const projectsDir = join(home, ".claude", "projects");

  let projectDirs: string[] = [];
  try {
    projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(projectsDir, d.name));
  } catch {
    return null;
  }

  let best: { ts: string; file: string; lineNo: number; line: string } | null = null;

  for (const dir of projectDirs) {
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const full = join(dir, file);
      let content: string;
      try {
        content = readFileSync(full, "utf8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('"error":"rate_limit"')) continue;

        try {
          const obj = JSON.parse(line) as ClaudeJsonl;
          if (obj.cwd !== cwd) continue;
          const ts = obj.timestamp;
          if (!ts) continue;

          if (!best || ts > best.ts) {
            best = { ts, file: full, lineNo: i + 1, line };
          }
        } catch {
          continue;
        }
      }
    }
  }

  if (!best) return null;
  return { file: best.file, lineNo: best.lineNo, line: best.line };
}

function secondsSince(isoTs: string): number {
  const t = isoToDate(isoTs).getTime();
  return Math.floor((Date.now() - t) / 1000);
}

async function main() {
  // 1. read runId from hook payload (stdin)
  const raw = (await readStdin()).trim();
  let runId: string | undefined;

  if (raw) {
    try {
      const payload = JSON.parse(raw) as HookPayload;
      runId = payload.runId;
    } catch {
      // ignore
    }
  }

  if (!runId) {
    console.error("No runId in hook payload; nothing to do.");
    process.exit(0);
  }

  // 2. look for the latest rate_limit entry in all project .jsonl files that matches our cwd
  const cwd = process.cwd();
  const hit = findLatestRateLimitLineForCwd(cwd);

  if (!hit) {
    // not an error – just means we haven't hit a rate limit (or can't find the log), so we can exit without doing anything.
    console.error(`No rate_limit entry found for cwd: ${cwd}`);
    process.exit(0);
  }

  const obj = JSON.parse(hit.line) as ClaudeJsonl;
  if (obj.error !== "rate_limit") {
    console.error(`Latest entry is not rate_limit (error=${obj.error})`);
    process.exit(0);
  }

  const ts = obj.timestamp;
  const text = obj.message?.content?.find((c) => c.type === "text")?.text ?? obj.message?.content?.[0]?.text;

  if (!ts || !text) {
    console.error("Missing timestamp or message text in rate_limit entry.");
    process.exit(0);
  }

  // 3)don't try to auto-resume if the rate_limit entry is too old (e.g. >10 minutes), since it might not be relevant anymore
  const ageSec = secondsSince(ts);
  const MAX_AGE_SEC = 10 * 60; // 10 minutes
  if (ageSec > MAX_AGE_SEC) {
    console.error(`rate_limit entry too old (${ageSec}s ago) — skipping auto-resume.`);
    process.exit(0);
  }

  const reset = parseResetText(text);
  if (!reset) {
    console.error(`Could not parse reset time from: ${text}`);
    process.exit(0);
  }

  const tz = reset.tz ?? "Asia/Jerusalem";
  const waitSeconds = secondsUntilReset(ts, reset.hour24, reset.minute, tz);

  console.error(`rate_limit: ${text} | ts=${ts} | waitSeconds=${waitSeconds} | source=${hit.file}:${hit.lineNo}`);
  if (waitSeconds > 0) {
    console.error(`Waiting ${waitSeconds} seconds until reset...`);
    await new Promise((r) => setTimeout(r, waitSeconds * 1000));
  }

  // 4. trigger `babysitter run:iterate <runId>` to resume the run

  
  const { spawnSync } = await import("child_process");
  const res = spawnSync("babysitter", ["run:iterate", runId], { stdio: "inherit" });
// לא להפיל את ה-hook – רק לדווח
  if ((res.status ?? 0) !== 0) {
    console.error(`[auto-resume] babysitter run:iterate failed with status=${res.status}`);
  }
  process.exit(0);

}

main().catch((e) => {
  console.error(String((e as any)?.stack ?? e));
  process.exit(0);
});
