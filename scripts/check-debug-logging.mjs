#!/usr/bin/env node
/**
 * Guard for the debug-logging rule in CLAUDE.md and docs/development/debug-logging.md.
 *
 * Shipped components must not call console.log/warn/info directly — the custom module
 * loads into Primo in every patron's browser, so diagnostic logging would otherwise dump
 * host/DOM objects and patron form data to the production console (issue #10).
 *
 * Use dlog()/dwarn() from src/app/services/debug.util.ts instead. They are off by default
 * and enabled at runtime with localStorage.setItem('tauDebug','1') — no rebuild needed.
 *
 * console.error is allowed: genuine, always-visible error reporting.
 *
 * Run: npm run check:debug-logging
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'src/app';

/** debug.util.ts is the logger itself — console.log/warn there is the implementation. */
const EXEMPT = ['src/app/services/debug.util.ts'];

/** Matches console.log/warn/info calls, but not console.error. */
const FORBIDDEN = /\bconsole\.(log|warn|info)\s*\(/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      yield path;
    }
  }
}

const violations = [];

for (const file of walk(SRC)) {
  const rel = relative('.', file).split('\\').join('/');
  if (EXEMPT.includes(rel)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Skip comment lines so prose mentioning console.log doesn't trip the guard.
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;

    FORBIDDEN.lastIndex = 0;
    if (FORBIDDEN.test(line)) {
      violations.push(`${rel}:${i + 1}  ${trimmed}`);
    }
  });
}

if (violations.length > 0) {
  console.error(
    `\n✖ ${violations.length} raw console call(s) in shipped source.\n` +
      `  Replace with dlog()/dwarn() from src/app/services/debug.util.ts.\n` +
      `  (console.error is allowed and is not reported here.)\n`
  );
  for (const v of violations) console.error(`    ${v}`);
  console.error('');
  process.exit(1);
}

console.log('✔ No raw console.log/warn/info in shipped source.');
