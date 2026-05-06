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
