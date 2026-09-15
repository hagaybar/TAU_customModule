/**
 * select-view.mjs — turns the VIEW_ID in build-settings.env into the content of the build.
 *
 * The organizing rule this exists to enforce: **build-settings.env selects, committed
 * source defines.** That file is edited casually before every build and CLAUDE.md says
 * doing so does not count as a source change, so it must never carry a definition. It
 * names the view; the table below decides what that view contains.
 *
 * Two mechanisms, because styling reaches the browser two different ways:
 *
 *   1. Compiled in. src/app/state/view.generated.ts re-exports one family's component
 *      map. The compiler only reaches what something imports, so the other family's
 *      components are not in the bundle — not excluded by a rule, simply never reached.
 *
 *   2. Copied verbatim. Primo fetches assets/css/custom.css and friends from a *fixed*
 *      URL, so nothing can be selected by import. The right file is copied over the
 *      fixed path instead, and paths the selected family does not provide are deleted
 *      rather than left behind from the previous build.
 *
 * Deliberately a new script rather than an edit to prebuild.js: prebuild.js is
 * byte-identical to upstream/main and every commit to it was authored by Ex Libris, so
 * editing it would trade a file that merges for free for one that conflicts forever.
 *
 * Design: docs/superpowers/specs/2026-09-09-per-view-isolation-design.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * A declared table, not a parser. `TMA_NDE` -> strip `_NDE` -> `tma` is clean until it
 * meets `NDE`, which strips to nothing; ordering rules follow, and then someone creates
 * `TMA2` in the Back Office and the parser guesses. The view id is a name Ex Libris' Back
 * Office owns, so inferring content from it would let a colleague change a build by
 * naming a view — and it fails in the wrong direction, because an unrecognized name still
 * yields *some* family and the wrong components ship.
 *
 * TMA is declared next to TMA_NDE from day one: that is what makes the test -> production
 * cutover one line in build-settings.env and zero lines of code.
 */
export const VIEW_FAMILY = {
  NDE: 'nde',
  NDE_TEST: 'nde',
  TMA_NDE: 'tma',
  TMA: 'tma',

  // TEMPORARY (2026-09-15). A throwaway duplicate of TMA_NDE, used to find out whether the
  // legacy homepage path still works — production NDE ships homepage_{en,he}.html and never
  // fetches them, so nothing at TAU proves that mechanism is alive. Delete this row when the
  // Back Office view is deleted; an undeclared view fails the build, which is how you will
  // find out if something still points at it.
  TMA_NDE_TEMP: 'tma',
};

export class UnknownViewError extends Error {
  constructor(viewId) {
    super(
      `Unknown VIEW_ID ${viewId === null || viewId === undefined ? '(missing from build-settings.env)' : `"${viewId}"`}. ` +
        `Known: ${Object.keys(VIEW_FAMILY).join(', ')}.\n` +
        `Add it to VIEW_FAMILY in scripts/select-view.mjs, with the family whose content it should ship.`,
    );
    this.name = 'UnknownViewError';
    this.viewId = viewId;
  }
}

const VIEWS_DIR = path.join('src', 'assets', 'views');
const GENERATED_TS = path.join('src', 'app', 'state', 'view.generated.ts');

/** VIEW_ID from build-settings.env text, or null. Anchored so PARENT_VIEW_ID does not match. */
export function readViewId(envText) {
  const match = envText.match(/^VIEW_ID=(.*)$/m);
  if (!match) return null;
  const value = match[1].trim();
  return value === '' ? null : value;
}

export function familyFor(viewId) {
  const family = VIEW_FAMILY[viewId];
  // No default. The safe outcome for an undeclared view is no package at all — the same
  // rule debug.util.ts already follows for VERBOSE_BY_DEFAULT.
  if (!family) throw new UnknownViewError(viewId);
  return family;
}

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Every fixed path any family can occupy, as posix-style paths relative to src/assets/.
 *
 * The union, not the selected family's set, because clearing is what stops the previous
 * build's content from surviving into this one. If `nde` ships a footer and `tma` does
 * not, a TMA build has to *remove* the NDE footer; leaving it there ships NDE's footer
 * inside a TMA package, which is the exact failure this whole design exists to prevent.
 */
export function managedAssetPaths(root) {
  const viewsRoot = path.join(root, VIEWS_DIR);
  if (!fs.existsSync(viewsRoot)) return [];
  const paths = new Set();
  for (const family of fs.readdirSync(viewsRoot, { withFileTypes: true })) {
    if (!family.isDirectory()) continue;
    for (const rel of walk(path.join(viewsRoot, family.name))) paths.add(rel);
  }
  return [...paths].sort();
}

/**
 * Generated destinations must be gitignored, or postbuild.js counts them as uncommitted
 * changes and stamps every package `-dirty` — which by TAU's own rule makes every package
 * unuploadable. That fails loudly but only after a build and an attempted deploy, so it is
 * cheaper to fail here, at generate time, naming the line to add.
 *
 * Skipped when there is no .gitignore, so the script still works outside a checkout.
 */
function assertGitignored(root, managed) {
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;
  const lines = new Set(
    fs
      .readFileSync(gitignorePath, 'utf8')
      .split('\n')
      .map((line) => line.trim()),
  );
  const missing = managed
    .map((rel) => `src/assets/${rel}`)
    .filter((dest) => !lines.has(dest) && !lines.has(`/${dest}`));
  if (missing.length) {
    throw new Error(
      `These generated files are not in .gitignore, so every package would build -dirty:\n` +
        missing.map((dest) => `  ${dest}`).join('\n') +
        `\nAdd those lines to .gitignore (see the "Per-view generated files" block there).`,
    );
  }
}

export function selectView({ root = process.cwd(), log = console.log } = {}) {
  const envPath = path.join(root, 'build-settings.env');
  if (!fs.existsSync(envPath)) throw new Error(`build-settings.env not found at ${envPath}`);

  // Resolve the family before touching anything: an undeclared VIEW_ID must leave the
  // tree exactly as it found it, not half-cleared.
  const viewId = readViewId(fs.readFileSync(envPath, 'utf8'));
  const family = familyFor(viewId);

  const familyAssets = path.join(root, VIEWS_DIR, family);
  if (!fs.existsSync(familyAssets)) {
    throw new Error(
      `View "${viewId}" is declared as family "${family}", but ${VIEWS_DIR}/${family} does not exist. ` +
        `Create it — a declared family with no assets would ship a package with no stylesheet.`,
    );
  }

  const managed = managedAssetPaths(root);
  assertGitignored(root, managed);

  for (const rel of managed) {
    const dest = path.join(root, 'src', 'assets', ...rel.split('/'));
    // Undo the read-only bit below before removing, so this works on Windows too.
    if (fs.existsSync(dest)) fs.chmodSync(dest, 0o644);
    fs.rmSync(dest, { force: true });
  }

  const provided = walk(familyAssets);
  for (const rel of provided) {
    const dest = path.join(root, 'src', 'assets', ...rel.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(familyAssets, ...rel.split('/')), dest);
    // Read-only, because these files still sit at the paths everyone has edited for years
    // and being gitignored is a silent guard: an edit here is simply lost at the next build,
    // with nothing to notice. A read-only bit makes the editor object at the moment someone
    // opens the wrong file, which is the only moment the warning is useful.
    fs.chmodSync(dest, 0o444);
  }

  const generatedPath = path.join(root, GENERATED_TS);
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.writeFileSync(
    generatedPath,
    `// GENERATED by scripts/select-view.mjs — do not edit; the next build overwrites it.\n` +
      `// VIEW_ID=${viewId} selects family "${family}".\n` +
      `export { map as selectorComponentMap } from '../views/${family}/component-map';\n`,
  );

  log(`✔ select-view: VIEW_ID=${viewId} → family "${family}"`);
  log(`  components: src/app/views/${family}/component-map.ts`);
  log(`  assets:     ${provided.length} file(s) copied from ${VIEWS_DIR}/${family}/`);
  const removed = managed.filter((rel) => !provided.includes(rel));
  if (removed.length) log(`  cleared:    ${removed.join(', ')} (not provided by "${family}")`);

  return { viewId, family, provided, removed };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    selectView({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') });
  } catch (error) {
    console.error(`✖ select-view failed.\n${error.message}`);
    process.exit(1);
  }
}
