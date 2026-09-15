/**
 * view-changes.mjs — which family does a changed file belong to?
 *
 * Its own module, and deliberately with no imports of its own beyond node builtins, because
 * both sides of the view machinery need it: select-view.mjs guards a build with it, and
 * view-state.mjs reports with it. view-state.mjs already imports select-view.mjs for the
 * family table, so putting these here is what keeps that from becoming a cycle.
 *
 * The family list is passed in rather than imported, for the same reason.
 */

import { execFileSync } from 'node:child_process';

/** Where a family's own, editable source lives. */
export function familyPaths(family) {
  return [`src/assets/views/${family}/`, `src/app/views/${family}/`];
}

/**
 * Paths that feed every family at once. A change here is not "the wrong family" — it is a
 * change to all of them, which is sometimes right and always worth saying out loud.
 */
export const SHARED_PATHS = [
  'src/app/custom1-module/',
  'src/app/app.module.ts',
  'src/styles.scss',
  'src/app/styles/',
  'src/assets/images/',
  'src/assets/icons/',
  'src/assets/cenlib-map/',
  'angular.json',
  'postbuild.js',
  'prebuild.js',
  'scripts/',
];

export function classify(file, family, allFamilies) {
  if (familyPaths(family).some((p) => file.startsWith(p))) return 'current';
  for (const other of new Set(allFamilies)) {
    if (other === family) continue;
    if (familyPaths(other).some((p) => file.startsWith(p))) return 'other';
  }
  if (SHARED_PATHS.some((p) => file.startsWith(p))) return 'shared';
  return 'unrelated';
}

export function classifyAll(files, family, allFamilies) {
  const out = { current: [], other: [], shared: [], unrelated: [] };
  for (const f of files) out[classify(f, family, allFamilies)].push(f);
  return out;
}

/**
 * Files changed but not yet committed. Deliberately not "changed since main": on a feature
 * branch that is everything, and a guard that always fires is a guard nobody reads.
 */
export function uncommittedFiles(root) {
  let out;
  try {
    out = execFileSync('git', ['status', '--porcelain'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return [];            // not a checkout, or git unavailable — nothing to check against
  }
  return out
    .split('\n')
    .filter((line) => line.trim() !== '')
    // Porcelain lines open with a two-character status field, often with a leading space.
    .map((line) => line.replace(/^.{2}\s+/, '').trim())
    // A rename reads "old -> new"; the new path is the one that matters here.
    .map((f) => (f.includes(' -> ') ? f.split(' -> ')[1] : f))
    .filter(Boolean);
}
