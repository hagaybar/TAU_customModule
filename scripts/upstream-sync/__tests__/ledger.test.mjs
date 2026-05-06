import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLedger, addEntry, hasSha, isSkipped } from '../ledger.mjs';

let tmpFile;

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `ledger-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
});

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.rmSync(tmpFile);
});

test('readLedger returns empty array for missing file', () => {
  assert.deepEqual(readLedger('/nonexistent/path/ledger.json'), []);
});

test('readLedger returns parsed entries for existing file', () => {
  fs.writeFileSync(tmpFile, JSON.stringify([{ sha: 'abc123', decision: 'applied' }]));
  assert.deepEqual(readLedger(tmpFile), [{ sha: 'abc123', decision: 'applied' }]);
});

test('readLedger throws on malformed JSON', () => {
  fs.writeFileSync(tmpFile, 'not json');
  assert.throws(() => readLedger(tmpFile), /JSON|Unexpected/);
});

test('addEntry appends to empty ledger', () => {
  fs.writeFileSync(tmpFile, '[]');
  addEntry(tmpFile, { sha: 'abc123', decision: 'applied', appliedAt: '2026-05-06' });
  const ledger = readLedger(tmpFile);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].sha, 'abc123');
  assert.equal(ledger[0].decision, 'applied');
});

test('addEntry preserves existing entries', () => {
  fs.writeFileSync(tmpFile, JSON.stringify([{ sha: 'old', decision: 'skipped' }]));
  addEntry(tmpFile, { sha: 'new', decision: 'applied' });
  const ledger = readLedger(tmpFile);
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].sha, 'old');
  assert.equal(ledger[1].sha, 'new');
});

test('addEntry creates the file if missing', () => {
  addEntry(tmpFile, { sha: 'abc', decision: 'applied' });
  assert.deepEqual(readLedger(tmpFile), [{ sha: 'abc', decision: 'applied' }]);
});

test('hasSha returns "applied" for applied entries', () => {
  fs.writeFileSync(tmpFile, JSON.stringify([{ sha: 'abc', decision: 'applied' }]));
  assert.equal(hasSha(tmpFile, 'abc'), 'applied');
});

test('hasSha returns "skipped" for skipped entries', () => {
  fs.writeFileSync(tmpFile, JSON.stringify([{ sha: 'abc', decision: 'skipped' }]));
  assert.equal(hasSha(tmpFile, 'abc'), 'skipped');
});

test('hasSha returns "none" for missing SHAs', () => {
  fs.writeFileSync(tmpFile, JSON.stringify([{ sha: 'abc', decision: 'applied' }]));
  assert.equal(hasSha(tmpFile, 'def'), 'none');
});

test('hasSha returns "none" for empty ledger', () => {
  fs.writeFileSync(tmpFile, '[]');
  assert.equal(hasSha(tmpFile, 'abc'), 'none');
});

test('isSkipped returns true only for skipped entries', () => {
  fs.writeFileSync(tmpFile, JSON.stringify([
    { sha: 'a', decision: 'applied' },
    { sha: 'b', decision: 'skipped' }
  ]));
  assert.equal(isSkipped(tmpFile, 'a'), false);
  assert.equal(isSkipped(tmpFile, 'b'), true);
  assert.equal(isSkipped(tmpFile, 'c'), false);
});

test('addEntry rejects entries with missing required fields', () => {
  fs.writeFileSync(tmpFile, '[]');
  assert.throws(() => addEntry(tmpFile, { decision: 'applied' }), /sha/);
  assert.throws(() => addEntry(tmpFile, { sha: 'abc' }), /decision/);
});

test('addEntry rejects invalid decision values', () => {
  fs.writeFileSync(tmpFile, '[]');
  assert.throws(() => addEntry(tmpFile, { sha: 'abc', decision: 'maybe' }), /decision/);
});
