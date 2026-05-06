import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyCommit } from '../classify.mjs';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const config = JSON.parse(readFileSync(path.join(repoRoot, '.upstream-sync/owned-files.json'), 'utf8'));

function changedFiles(sha) {
  return execFileSync('git', ['show', '--name-only', '--pretty=format:', sha], { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// All currently-pending upstream commits should bucket as 'structural' or 'owned-touch'
// because every one of them touches files we customized (build infra, styles, services).
// If any bucket as 'clean', the categories config needs expansion.
const pendingShas = execFileSync('git', ['log', '--format=%H', 'upstream/main', '^main'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

for (const sha of pendingShas) {
  test(`pending upstream ${sha.slice(0, 7)} should not bucket as clean (or document why it can)`, () => {
    const result = classifyCommit(changedFiles(sha), config);
    if (result.bucket === 'clean') {
      // Failing case — print enough diagnostics to fix it
      assert.fail(
        `Commit ${sha.slice(0, 7)} bucketed as clean.\n` +
        `Changed files: ${result.changedFiles.join(', ')}\n` +
        `If these files truly aren't TAU-customized, this is fine — mark this test as expected.\n` +
        `Otherwise, add the relevant glob to .upstream-sync/owned-files.json.`
      );
    }
  });
}
