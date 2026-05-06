import fs from 'node:fs';

const VALID_DECISIONS = new Set(['applied', 'skipped']);

/**
 * Read the ledger file. Returns [] if file doesn't exist.
 * Throws on malformed JSON.
 */
export function readLedger(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Append an entry to the ledger. Creates the file if missing.
 * Required fields: sha, decision ('applied' | 'skipped').
 * Optional: subject, appliedAt, branch, reason.
 */
export function addEntry(filePath, entry) {
  if (!entry.sha) throw new Error('entry.sha is required');
  if (!entry.decision) throw new Error('entry.decision is required');
  if (!VALID_DECISIONS.has(entry.decision)) {
    throw new Error(`entry.decision must be one of: ${[...VALID_DECISIONS].join(', ')}`);
  }
  const current = readLedger(filePath);
  current.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2) + '\n');
}

/**
 * Returns the decision for a SHA, or 'none' if not in ledger.
 */
export function hasSha(filePath, sha) {
  const ledger = readLedger(filePath);
  const found = ledger.find((e) => e.sha === sha);
  return found ? found.decision : 'none';
}

/**
 * Returns true iff the SHA is recorded as skipped.
 */
export function isSkipped(filePath, sha) {
  return hasSha(filePath, sha) === 'skipped';
}

// CLI entrypoint
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const ledgerPath = path.join(repoRoot, 'docs', 'upstream-sync', 'applied.json');

  const cmd = process.argv[2];
  switch (cmd) {
    case 'has-sha': {
      const sha = process.argv[3];
      if (!sha) { console.error('Usage: ledger.mjs has-sha <sha>'); process.exit(2); }
      const status = hasSha(ledgerPath, sha);
      console.log(status);
      process.exit(status === 'none' ? 1 : 0);
    }
    case 'add': {
      const args = process.argv.slice(3);
      const entry = {};
      for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, '');
        entry[key] = args[i + 1];
      }
      addEntry(ledgerPath, entry);
      console.log(`Added ${entry.sha} (${entry.decision})`);
      break;
    }
    case 'list': {
      console.log(JSON.stringify(readLedger(ledgerPath), null, 2));
      break;
    }
    default:
      console.error('Usage: ledger.mjs <has-sha|add|list> [args...]');
      console.error('  has-sha <sha>');
      console.error('  add --sha <sha> --decision <applied|skipped> [--subject "..."] [--appliedAt YYYY-MM-DD] [--branch <name>] [--reason "..."]');
      console.error('  list');
      process.exit(2);
  }
}
