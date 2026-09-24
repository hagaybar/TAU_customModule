/**
 * view-use.mjs — point this session at a view.
 *
 *   npm run view:use nde
 *   npm run view:use nde-test
 *   npm run view:use tma
 *
 * Writes VIEW_ID and ASSET_BASE_URL together. Doing it by hand is two edits that have to
 * agree, and getting one right and the other wrong produces a package whose assets 404 —
 * which is exactly the failure CLAUDE.md's "Critical Build Requirements" section is about.
 *
 * Then regenerates, so the tree matches the declaration immediately rather than at the next
 * build, and prints the new state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { VIEW_FAMILY } from './select-view.mjs';
import { readEnv, uncommittedFiles, classifyForFamily, familyFor } from './view-state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Short names, because "nde-test" is easier to say and harder to typo than "NDE_TEST".
const ALIASES = { nde: 'NDE', 'nde-test': 'NDE_TEST', ndetest: 'NDE_TEST', tma: 'TMA_NDE', 'tma-nde': 'TMA_NDE' };

const arg = (process.argv[2] || '').trim();
if (!arg) {
  console.error('Usage: npm run view:use <nde|nde-test|tma>');
  console.error(`Or any declared VIEW_ID: ${Object.keys(VIEW_FAMILY).join(', ')}`);
  process.exit(2);
}

const viewId = ALIASES[arg.toLowerCase()] || arg.toUpperCase();
if (!VIEW_FAMILY[viewId]) {
  const shown = arg.toUpperCase() === viewId ? viewId : `${arg} (read as ${viewId})`;
  console.error(`Unknown view ${shown}.`);
  console.error(`Declared views: ${Object.keys(VIEW_FAMILY).join(', ')}`);
  console.error('A new view has to be added to VIEW_FAMILY in scripts/select-view.mjs first.');
  process.exit(2);
}

const before = readEnv(ROOT);

// Switching view while work sits uncommitted in the family you are leaving is how an edit
// ends up orphaned — it stays on disk, but nothing you build afterwards contains it.
if (before.viewId && before.viewId !== viewId) {
  const leaving = familyFor(before.viewId);
  const stranded = classifyForFamily(uncommittedFiles(ROOT), leaving).current;
  if (stranded.length) {
    console.error(`Refusing to switch: ${stranded.length} uncommitted file(s) in the ${leaving} family.`);
    for (const f of stranded.slice(0, 10)) console.error(`    ${f}`);
    console.error('Commit or discard them first, or they will sit on disk in no build at all.');
    process.exit(1);
  }
}

const updated = before.text
  .replace(/^VIEW_ID=.*$/m, `VIEW_ID=${viewId}`)
  .replace(/^ASSET_BASE_URL=.*$/m, `ASSET_BASE_URL=/nde/custom/${before.instId}-${viewId}`);

if (!/^VIEW_ID=/m.test(updated) || !/^ASSET_BASE_URL=/m.test(updated)) {
  console.error('build-settings.env is missing VIEW_ID or ASSET_BASE_URL; not rewriting it blind.');
  process.exit(1);
}

fs.writeFileSync(before.path, updated);
console.log(`build-settings.env → VIEW_ID=${viewId}, ASSET_BASE_URL=/nde/custom/${before.instId}-${viewId}`);

execFileSync('npm', ['run', 'generate', '--silent'], { cwd: ROOT, stdio: 'inherit' });
console.log('');
execFileSync('node', ['scripts/view-status.mjs'], { cwd: ROOT, stdio: 'inherit' });
