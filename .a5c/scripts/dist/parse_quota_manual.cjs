"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
function parseResetText(text) {
    // Matches: "You've hit your limit · resets 9pm (Asia/Jerusalem)"
    // Also accepts: "resets 15:00 (Asia/Jerusalem)" and "resets 3pm"
    const m = text.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:\(([^)]+)\))?/i) ??
        text.match(/resets\s+(\d{1,2}):(\d{2})\s*(?:\(([^)]+)\))?/i);
    if (!m)
        return null;
    // Branch 1: am/pm format
    if (m.length >= 4 && (m[3]?.toLowerCase?.() === "am" || m[3]?.toLowerCase?.() === "pm")) {
        let hour = Number(m[1]);
        const minute = m[2] ? Number(m[2]) : 0;
        const ampm = String(m[3]).toLowerCase();
        const tz = m[4];
        if (ampm === "pm" && hour !== 12)
            hour += 12;
        if (ampm === "am" && hour === 12)
            hour = 0;
        return { hour24: hour, minute, tz };
    }
    // Branch 2: 24h format (HH:MM)
    const hour24 = Number(m[1]);
    const minute = Number(m[2]);
    const tz = m[3];
    if (Number.isNaN(hour24) || Number.isNaN(minute))
        return null;
    return { hour24, minute, tz };
}
function isoToDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        throw new Error(`Bad ISO timestamp: ${iso}`);
    return d;
}
function secondsUntilReset(timestampIso, resetHour, resetMinute, tz) {
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
    function zonedToUtc(year, month, day, hour, minute) {
        const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
        const p = Object.fromEntries(fmt.formatToParts(guess).map((pp) => [pp.type, pp.value]));
        const zy = Number(p.year), zmo = Number(p.month), zda = Number(p.day), zh = Number(p.hour), zmin = Number(p.minute);
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
function findLatestRateLimitLineForCwd(cwd) {
    const home = process.env.HOME || "";
    if (!home)
        return null;
    const projectsDir = (0, path_1.join)(home, ".claude", "projects");
    let projectDirs = [];
    try {
        projectDirs = (0, fs_1.readdirSync)(projectsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => (0, path_1.join)(projectsDir, d.name));
    }
    catch {
        return null;
    }
    let best = null;
    for (const dir of projectDirs) {
        let files = [];
        try {
            files = (0, fs_1.readdirSync)(dir).filter((f) => f.endsWith(".jsonl"));
        }
        catch {
            continue;
        }
        for (const file of files) {
            const full = (0, path_1.join)(dir, file);
            let content;
            try {
                content = (0, fs_1.readFileSync)(full, "utf8");
            }
            catch {
                continue;
            }
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line.includes('"error":"rate_limit"'))
                    continue;
                try {
                    const obj = JSON.parse(line);
                    if (obj.cwd !== cwd)
                        continue;
                    const ts = obj.timestamp;
                    if (!ts)
                        continue;
                    if (!best || ts > best.ts) {
                        best = { ts, file: full, lineNo: i + 1, line };
                    }
                }
                catch {
                    continue;
                }
            }
        }
    }
    if (!best)
        return null;
    return { file: best.file, lineNo: best.lineNo, line: best.line };
}
async function main() {
    const cwd = process.cwd();
    const hit = findLatestRateLimitLineForCwd(cwd);
    if (!hit) {
        console.error(`No rate_limit entry found for cwd: ${cwd}`);
        process.exit(1);
    }
    const obj = JSON.parse(hit.line);
    if (obj.error !== "rate_limit") {
        console.error(`Latest entry is not rate_limit (error=${obj.error})`);
        process.exit(1);
    }
    const ts = obj.timestamp;
    const text = obj.message?.content?.find((c) => c.type === "text")?.text ?? obj.message?.content?.[0]?.text;
    if (!ts || !text) {
        console.error("Missing timestamp or message text in rate_limit entry.");
        process.exit(1);
    }
    const reset = parseResetText(text);
    if (!reset) {
        console.error(`Could not parse reset time from: ${text}`);
        process.exit(1);
    }
    const tz = reset.tz ?? "Asia/Jerusalem";
    const waitSeconds = secondsUntilReset(ts, reset.hour24, reset.minute, tz);
    const runId = process.argv[2];
    if (!runId) {
        console.error("Usage: node parse_quota.cjs <runId>");
        process.exit(1);
    }
    console.error(`rate_limit: ${text} | ts=${ts} | waitSeconds=${waitSeconds} | source=${hit.file}:${hit.lineNo}`);
    // wait until the reset time
    if (waitSeconds > 0) {
        console.error(`Waiting ${waitSeconds} seconds until reset...`);
        await new Promise((r) => setTimeout(r, waitSeconds * 1000));
    }
    // rerun the babysitter run after waiting
    const { spawnSync } = await Promise.resolve().then(() => require("child_process"));
    const res = spawnSync("babysitter", ["run:iterate", runId], { stdio: "inherit" });
    console.log(JSON.stringify({
        cwd,
        sourceFile: hit.file,
        sourceLine: hit.lineNo,
        timestamp: ts,
        text,
        tz,
        waitSeconds,
    }, null, 2));
    process.exit(res.status ?? 0);
}
main().catch((e) => {
    console.error(String(e?.stack ?? e));
    process.exit(2);
});
