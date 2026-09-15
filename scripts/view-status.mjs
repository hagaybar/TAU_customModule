/**
 * view-status.mjs — print the view this session is directed at.
 *
 * Run by `npm run view`, by the /view slash command, and by a SessionStart hook so that
 * every agent begins with it already in context. That last one is the point: the view stops
 * being something anyone has to remember to check.
 *
 *   node scripts/view-status.mjs           human-readable
 *   node scripts/view-status.mjs --brief    one block, for the session hook
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { summary } from './view-state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brief = process.argv.includes('--brief');

function ago(iso) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

const s = summary(ROOT);

console.log(`View    ${s.instId}:${s.viewId}   family: ${s.family}`);
console.log(`  edits  → ${s.editPaths.map((p) => p + '**').join('   ')}`);
console.log(`  builds → ${s.package}`);

// The whole reason this exists: an unqualified request resolves here, not by guesswork.
console.log(`  an unqualified request ("remove the logo") means the ${s.family} family.`);
console.log(`  to work on another view: npm run view:use <nde|nde-test|tma>`);

const foreign = s.uncommitted.other;
if (foreign.length) {
  console.log('');
  console.log(`⚠ ${foreign.length} uncommitted file(s) belong to another family, not ${s.family}:`);
  for (const f of foreign.slice(0, 10)) console.log(`    ${f}`);
  if (foreign.length > 10) console.log(`    … and ${foreign.length - 10} more`);
  console.log('  Either this session is pointed at the wrong view, or those edits went to');
  console.log('  the wrong place. A build will refuse until it is one or the other.');
}

if (brief) process.exit(0);

console.log('');
if (!s.lastBuild) {
  console.log('Last build   none archived for this view yet');
} else {
  const b = s.lastBuild;
  console.log(`Last build   ${b.commit}${b.dirty ? '-dirty' : ''}   ${ago(b.builtUtc)}   ${path.basename(b.file)}`);
  const c = s.changedSinceBuild;
  const total = c.current.length + c.other.length + c.shared.length;
  if (total === 0) {
    console.log('             nothing has changed since — the archived package is current');
  } else {
    console.log(`             ${total} file(s) changed since, so that package is stale:`);
    const show = (label, files) => {
      if (!files.length) return;
      console.log(`               ${label}`);
      for (const f of files.slice(0, 8)) console.log(`                 ${f}`);
      if (files.length > 8) console.log(`                 … and ${files.length - 8} more`);
    };
    show(`${s.family} family`, c.current);
    show('shared by every view', c.shared);
    show('another family', c.other);
  }
}
