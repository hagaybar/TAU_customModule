# Upstream Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manually-triggered Claude Code skill (`upstream-sync`) that analyzes new upstream commits from `ExLibrisGroup/customModule`, classifies each by impact on TAU's customizations using a deterministic file-path → category map, and lets the user selectively cherry-pick chosen commits onto a verification branch with `npm run build` gating before opening a PR.

**Architecture:** Two small Node CLI scripts (`classify.mjs`, `ledger.mjs`) provide deterministic classification and ledger I/O. A category-based JSON config (`.upstream-sync/owned-files.json`) maps TAU-customized files to categories with risk levels. The skill itself (`.claude/skills/upstream-sync/SKILL.md`) orchestrates the conversational flow: invokes the scripts, formats reports, drives cherry-pick + build + PR via the existing `git-expert` skill. Analyses are written to `docs/upstream-sync/<date>.md`; decisions are recorded in `docs/upstream-sync/applied.json`.

**Tech Stack:** Node 20 (native `node:test`, ESM `.mjs`), `picomatch` for glob matching, plain shell `git` for all VCS ops, GitHub CLI (`gh`) for PRs (already used by `git-expert`).

**Reference:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md`

---

## File Structure

```
.upstream-sync/
  owned-files.json                            # category config (CREATE)

scripts/upstream-sync/
  classify.mjs                                # classifier + CLI (CREATE)
  ledger.mjs                                  # ledger I/O + CLI (CREATE)
  __tests__/
    classify.test.mjs                         # node:test tests (CREATE)
    ledger.test.mjs                           # node:test tests (CREATE)

docs/upstream-sync/
  applied.json                                # decisions ledger (CREATE, empty)
  README.md                                   # quick reference (CREATE)

.claude/skills/upstream-sync/
  SKILL.md                                    # skill definition (CREATE)

.github/workflows/sync-fork.yml               # add legacy notice (MODIFY)
CLAUDE.md                                     # add skill reference (MODIFY)
package.json                                  # add picomatch + test script (MODIFY)
```

---

## Task 1: Set up directory structure and seed empty files

**Files:**
- Create: `.upstream-sync/.gitkeep`
- Create: `scripts/upstream-sync/.gitkeep`
- Create: `scripts/upstream-sync/__tests__/.gitkeep`
- Create: `docs/upstream-sync/applied.json`
- Create: `.claude/skills/upstream-sync/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p .upstream-sync scripts/upstream-sync/__tests__ docs/upstream-sync .claude/skills/upstream-sync
```

- [ ] **Step 2: Create empty ledger**

Create `docs/upstream-sync/applied.json` with content:

```json
[]
```

- [ ] **Step 3: Create `.gitkeep` placeholders for empty dirs**

```bash
touch .upstream-sync/.gitkeep scripts/upstream-sync/__tests__/.gitkeep .claude/skills/upstream-sync/.gitkeep
```

- [ ] **Step 4: Verify structure**

Run: `find .upstream-sync scripts/upstream-sync docs/upstream-sync .claude/skills/upstream-sync -type f`
Expected output (order may vary):
```
.upstream-sync/.gitkeep
scripts/upstream-sync/.gitkeep
scripts/upstream-sync/__tests__/.gitkeep
docs/upstream-sync/applied.json
.claude/skills/upstream-sync/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add .upstream-sync scripts/upstream-sync docs/upstream-sync .claude/skills/upstream-sync
git commit -m "chore: scaffold upstream-sync directories"
```

---

## Task 2: Add `picomatch` devDependency and `test:upstream-sync` script

**Why:** `picomatch` is the smallest correct glob matcher. It's transitively present via Angular but we add it explicitly so the script doesn't break if upstream drops it.

**Files:**
- Modify: `package.json` (devDependencies block; scripts block)

- [ ] **Step 1: Install picomatch as devDependency**

```bash
npm install --save-dev picomatch
```

Expected: `picomatch` added to `devDependencies`. Confirm with:
```bash
node -e "console.log(require('./package.json').devDependencies.picomatch)"
```
Expected output: a version string (e.g., `^4.0.2`).

- [ ] **Step 2: Add `test:upstream-sync` script**

Open `package.json`. In the `"scripts"` block, after `"watch"` line, add:

```json
"test:upstream-sync": "node --test scripts/upstream-sync/__tests__/",
```

- [ ] **Step 3: Verify script registration**

Run: `npm run test:upstream-sync`
Expected: command runs, finds no test files yet, exits 0 or with "no tests found" — that's fine (we'll add tests next). If it errors on the command itself, fix the script.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add picomatch + upstream-sync test runner"
```

---

## Task 3: Create `owned-files.json` category config

**Files:**
- Create: `.upstream-sync/owned-files.json`

- [ ] **Step 1: Write config file**

Create `.upstream-sync/owned-files.json`:

```json
{
  "categories": {
    "build-infrastructure": {
      "risk": "high",
      "description": "Parametric build via build-settings.env, asset path generation",
      "files": [
        "prebuild.js",
        "postbuild.js",
        "webpack.config.js",
        "webpack.prod.config.js",
        "build-settings.env",
        "angular.json",
        "tsconfig*.json"
      ]
    },
    "module-registration": {
      "risk": "high",
      "description": "Where TAU components attach into Primo's app",
      "files": [
        "src/app/app.module.ts",
        "src/app/injection-tokens.ts"
      ]
    },
    "proxy-config": {
      "risk": "high",
      "description": "Local dev proxy to Primo, parametric per build-settings",
      "files": [
        "proxy/**"
      ]
    },
    "external-search-integration": {
      "risk": "medium",
      "description": "FilterAssistPanel + NoResultsExternalLinks (ULI/WorldCat/Scholar)",
      "files": [
        "src/app/custom1-module/filter-assist-panel/**",
        "src/app/custom1-module/no-results-external-links/**",
        "src/assets/images/external-sources/**"
      ]
    },
    "homepage": {
      "risk": "medium",
      "description": "Custom homepage HTML/CSS",
      "files": [
        "src/assets/homepage/**"
      ]
    },
    "header-footer": {
      "risk": "medium",
      "description": "Custom header and footer for English/Hebrew",
      "files": [
        "src/assets/header-footer/**"
      ]
    },
    "global-styles": {
      "risk": "medium",
      "description": "Project-wide style entrypoints",
      "files": [
        "src/styles.scss",
        "src/assets/css/**"
      ]
    },
    "branding": {
      "risk": "low",
      "description": "Logos, license, project documentation",
      "files": [
        "src/assets/images/library-logo*",
        "README.md",
        "CLAUDE.md",
        "SPECS.md",
        "LICENSE",
        "docs/**"
      ]
    }
  },
  "ignored": [
    ".a5c/**",
    ".claude/**",
    ".angular/**",
    ".playwright-mcp/**"
  ]
}
```

- [ ] **Step 2: Validate JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('.upstream-sync/owned-files.json'))"`
Expected: exits 0 with no output. If it throws, fix the syntax error and retry.

- [ ] **Step 3: Commit**

```bash
git add .upstream-sync/owned-files.json
git commit -m "feat(upstream-sync): add owned-files category config"
```

---

## Task 4: Write tests for `classifyCommit` (pure function)

**Files:**
- Create: `scripts/upstream-sync/__tests__/classify.test.mjs`

- [ ] **Step 1: Write the test file**

Create `scripts/upstream-sync/__tests__/classify.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommit } from '../classify.mjs';

const config = {
  categories: {
    'build-infrastructure': {
      risk: 'high',
      files: ['prebuild.js', 'webpack.config.js', 'tsconfig*.json']
    },
    'module-registration': {
      risk: 'high',
      files: ['src/app/app.module.ts']
    },
    'homepage': {
      risk: 'medium',
      files: ['src/assets/homepage/**']
    },
    'branding': {
      risk: 'low',
      files: ['README.md', 'docs/**']
    }
  },
  ignored: ['.a5c/**', '.claude/**']
};

test('clean commit (no owned files) → bucket: clean, recommendation: safe to pull', () => {
  const result = classifyCommit(['src/app/services/some-service.ts'], config);
  assert.equal(result.bucket, 'clean');
  assert.equal(result.recommendation, 'safe to pull');
  assert.deepEqual(result.matchedCategories, []);
});

test('high-risk hit → bucket: structural, recommendation: needs review', () => {
  const result = classifyCommit(['prebuild.js'], config);
  assert.equal(result.bucket, 'structural');
  assert.equal(result.recommendation, 'needs review');
  assert.deepEqual(result.matchedCategories, ['build-infrastructure']);
});

test('medium-risk only → bucket: owned-touch, recommendation: worth a look', () => {
  const result = classifyCommit(['src/assets/homepage/index.html'], config);
  assert.equal(result.bucket, 'owned-touch');
  assert.equal(result.recommendation, 'worth a look');
  assert.deepEqual(result.matchedCategories, ['homepage']);
});

test('low-risk only → bucket: owned-touch, recommendation: worth a look', () => {
  const result = classifyCommit(['README.md'], config);
  assert.equal(result.bucket, 'owned-touch');
  assert.equal(result.recommendation, 'worth a look');
  assert.deepEqual(result.matchedCategories, ['branding']);
});

test('high+medium hit → bucket: structural (high wins), all matched categories listed', () => {
  const result = classifyCommit(['prebuild.js', 'src/assets/homepage/index.html'], config);
  assert.equal(result.bucket, 'structural');
  assert.equal(result.recommendation, 'needs review');
  assert.ok(result.matchedCategories.includes('build-infrastructure'));
  assert.ok(result.matchedCategories.includes('homepage'));
});

test('ignored files filtered before category matching', () => {
  const result = classifyCommit(['.a5c/runs/x.json', 'src/foo.ts'], config);
  assert.equal(result.bucket, 'clean');
  assert.deepEqual(result.changedFiles, ['src/foo.ts']);
});

test('only-ignored commit → clean with empty changedFiles', () => {
  const result = classifyCommit(['.a5c/runs/x.json', '.claude/skills/foo/SKILL.md'], config);
  assert.equal(result.bucket, 'clean');
  assert.deepEqual(result.changedFiles, []);
});

test('glob ** matches files in any subdirectory', () => {
  const result = classifyCommit(['src/assets/homepage/sub/dir/file.css'], config);
  assert.deepEqual(result.matchedCategories, ['homepage']);
});

test('glob with * in name matches', () => {
  const result = classifyCommit(['tsconfig.app.json'], config);
  assert.deepEqual(result.matchedCategories, ['build-infrastructure']);
});

test('file in multiple categories returns all of them', () => {
  const cfg = {
    categories: {
      'a': { risk: 'medium', files: ['shared.ts'] },
      'b': { risk: 'low', files: ['shared.ts'] }
    },
    ignored: []
  };
  const result = classifyCommit(['shared.ts'], cfg);
  assert.equal(result.matchedCategories.length, 2);
  assert.ok(result.matchedCategories.includes('a'));
  assert.ok(result.matchedCategories.includes('b'));
});

test('empty changedFiles → clean', () => {
  const result = classifyCommit([], config);
  assert.equal(result.bucket, 'clean');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:upstream-sync`
Expected: tests fail with "Cannot find module" or similar — `classify.mjs` doesn't exist yet.

---

## Task 5: Implement `classifyCommit` to make tests pass

**Files:**
- Create: `scripts/upstream-sync/classify.mjs`

- [ ] **Step 1: Create the implementation**

Create `scripts/upstream-sync/classify.mjs`:

```javascript
import picomatch from 'picomatch';

/**
 * Classify a commit by which TAU-owned categories its changed files touch.
 *
 * @param {string[]} changedFiles - paths from `git show --name-only <sha>`
 * @param {object} config - parsed contents of `.upstream-sync/owned-files.json`
 * @returns {{
 *   changedFiles: string[],   // input minus ignored
 *   matchedCategories: string[],
 *   bucket: 'clean' | 'owned-touch' | 'structural',
 *   recommendation: 'safe to pull' | 'worth a look' | 'needs review'
 * }}
 */
export function classifyCommit(changedFiles, config) {
  const ignoredMatchers = (config.ignored || []).map((p) => picomatch(p));
  const filteredFiles = changedFiles.filter(
    (f) => !ignoredMatchers.some((m) => m(f))
  );

  const matchedCategories = [];
  const risksHit = new Set();

  for (const [name, cat] of Object.entries(config.categories || {})) {
    const matchers = (cat.files || []).map((p) => picomatch(p));
    const hit = filteredFiles.some((f) => matchers.some((m) => m(f)));
    if (hit) {
      matchedCategories.push(name);
      risksHit.add(cat.risk);
    }
  }

  let bucket;
  let recommendation;
  if (risksHit.has('high')) {
    bucket = 'structural';
    recommendation = 'needs review';
  } else if (risksHit.size > 0) {
    bucket = 'owned-touch';
    recommendation = 'worth a look';
  } else {
    bucket = 'clean';
    recommendation = 'safe to pull';
  }

  return {
    changedFiles: filteredFiles,
    matchedCategories,
    bucket,
    recommendation,
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test:upstream-sync`
Expected: all 11 `classify.test.mjs` tests pass. If any fail, fix the implementation (do not change the tests).

- [ ] **Step 3: Commit**

```bash
git add scripts/upstream-sync/classify.mjs scripts/upstream-sync/__tests__/classify.test.mjs
git commit -m "feat(upstream-sync): add classifyCommit pure function"
```

---

## Task 6: Add CLI entrypoint to `classify.mjs`

**Why:** The skill calls this from Bash with a SHA; we need a small CLI wrapper that runs `git show` and prints JSON.

**Files:**
- Modify: `scripts/upstream-sync/classify.mjs` (append CLI block at end)

- [ ] **Step 1: Append CLI block to `classify.mjs`**

Add at the end of `scripts/upstream-sync/classify.mjs`:

```javascript

// CLI entrypoint
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sha = process.argv[2];
  if (!sha) {
    console.error('Usage: classify.mjs <sha>');
    process.exit(2);
  }

  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const configPath = path.join(repoRoot, '.upstream-sync', 'owned-files.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  // Resolve to full SHA so output is canonical
  const fullSha = execFileSync('git', ['rev-parse', sha], { encoding: 'utf8' }).trim();
  const files = execFileSync('git', ['show', '--name-only', '--pretty=format:', fullSha], { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const result = classifyCommit(files, config);
  console.log(JSON.stringify({ sha: fullSha, ...result }, null, 2));
}
```

- [ ] **Step 2: Smoke-test the CLI on a real commit**

Pick a current upstream commit. Run:
```bash
git fetch upstream 2>/dev/null
node scripts/upstream-sync/classify.mjs c1eb45f
```
Expected output: a JSON object containing `sha`, `changedFiles`, `matchedCategories`, `bucket`, `recommendation`. The bucket should be `structural` (this commit touches `prebuild.js` and `webpack.config.js`).

- [ ] **Step 3: Verify exit code on bad input**

Run: `node scripts/upstream-sync/classify.mjs`
Expected: exit code 2, stderr "Usage: classify.mjs <sha>".

Run: `node scripts/upstream-sync/classify.mjs notasha`
Expected: non-zero exit, git error from `rev-parse`.

- [ ] **Step 4: Verify tests still pass**

Run: `npm run test:upstream-sync`
Expected: all classifier tests still pass (the CLI block doesn't run during tests because `process.argv[1]` won't match).

- [ ] **Step 5: Commit**

```bash
git add scripts/upstream-sync/classify.mjs
git commit -m "feat(upstream-sync): add classify CLI entrypoint"
```

---

## Task 7: Write tests for ledger functions

**Files:**
- Create: `scripts/upstream-sync/__tests__/ledger.test.mjs`

- [ ] **Step 1: Write the test file**

Create `scripts/upstream-sync/__tests__/ledger.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:upstream-sync`
Expected: ledger tests fail with "Cannot find module" — `ledger.mjs` doesn't exist yet. classifier tests should still pass.

---

## Task 8: Implement ledger functions to make tests pass

**Files:**
- Create: `scripts/upstream-sync/ledger.mjs`

- [ ] **Step 1: Write the implementation**

Create `scripts/upstream-sync/ledger.mjs`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test:upstream-sync`
Expected: all ledger tests pass; classifier tests still pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/upstream-sync/ledger.mjs scripts/upstream-sync/__tests__/ledger.test.mjs
git commit -m "feat(upstream-sync): add ledger read/write helpers"
```

---

## Task 9: Add CLI entrypoint to `ledger.mjs`

**Why:** The skill needs to query the ledger and append entries from Bash.

**Files:**
- Modify: `scripts/upstream-sync/ledger.mjs` (append CLI block at end)

- [ ] **Step 1: Append CLI block**

Add at the end of `scripts/upstream-sync/ledger.mjs`:

```javascript

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
```

- [ ] **Step 2: Smoke-test each CLI subcommand**

Run: `node scripts/upstream-sync/ledger.mjs list`
Expected: `[]` (empty ledger).

Run: `node scripts/upstream-sync/ledger.mjs has-sha abc123`
Expected: `none`, exit code 1.

Run: `node scripts/upstream-sync/ledger.mjs add --sha test123 --decision applied --subject "smoke test"`
Expected: `Added test123 (applied)`. File now contains the entry.

Run: `node scripts/upstream-sync/ledger.mjs has-sha test123`
Expected: `applied`, exit code 0.

Run: `node scripts/upstream-sync/ledger.mjs list`
Expected: JSON array with the test123 entry.

- [ ] **Step 3: Reset the ledger to empty**

```bash
echo '[]' > docs/upstream-sync/applied.json
```

- [ ] **Step 4: Verify tests still pass**

Run: `npm run test:upstream-sync`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/upstream-sync/ledger.mjs docs/upstream-sync/applied.json
git commit -m "feat(upstream-sync): add ledger CLI entrypoint"
```

---

## Task 10: Validate classifier against historical commits

**Why:** The spec requires confirming no past upstream-conflict commit would have bucketed as `clean`. If any did, the categories need to grow before we trust the skill.

**Files:**
- Create: `scripts/upstream-sync/__tests__/historical-validation.test.mjs`

- [ ] **Step 1: Identify historical conflict SHAs**

Past conflict files (from PR #2 `sync/conflicts`): `LICENSE`, `prebuild.js`, `proxy/customization_config_override.mjs`, `proxy/proxy.conf.mjs`, `src/app/app.module.ts`, `src/app/injection-tokens.ts`.

Find the upstream commits that introduced changes to these files, by inspecting which upstream commits in the not-yet-merged range touch them:

```bash
git fetch upstream 2>/dev/null
for f in LICENSE prebuild.js proxy/customization_config_override.mjs proxy/proxy.conf.mjs src/app/app.module.ts src/app/injection-tokens.ts; do
  echo "=== $f ==="
  git log --oneline upstream/main -- "$f" | head -5
done
```

Record the SHAs of the most recent upstream commits touching each. These are our "must-not-be-clean" canaries.

- [ ] **Step 2: Identify currently-pending upstream commits**

```bash
git log --oneline upstream/main ^main
```
Note all SHAs printed. Each will be classified.

- [ ] **Step 3: Write the validation test**

Create `scripts/upstream-sync/__tests__/historical-validation.test.mjs`:

```javascript
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
```

- [ ] **Step 4: Run the validation**

Run: `npm run test:upstream-sync`
Expected: all 8 pending upstream commits classify as `structural` or `owned-touch`. If any classify as `clean`, examine the output, then either:
1. Add the relevant glob to `.upstream-sync/owned-files.json` (re-run `Task 3 step 2` JSON validation), and re-run the test, **or**
2. Confirm by inspection that the file is genuinely untouched by TAU and skip that case (rare).

If the test reveals legitimate gaps in `owned-files.json`, **fix the JSON** (don't relax the test) and commit the JSON change separately:

```bash
git add .upstream-sync/owned-files.json
git commit -m "feat(upstream-sync): expand owned-files config based on historical validation"
```

- [ ] **Step 5: Commit the validation test**

```bash
git add scripts/upstream-sync/__tests__/historical-validation.test.mjs
git commit -m "test(upstream-sync): validate classifier against pending upstream commits"
```

---

## Task 11: Write `SKILL.md`

**Files:**
- Create: `.claude/skills/upstream-sync/SKILL.md`

- [ ] **Step 1: Write the skill definition**

Create `.claude/skills/upstream-sync/SKILL.md`:

````markdown
---
name: upstream-sync
description: Manually-triggered upstream sync for the TAU customModule fork (origin → ExLibrisGroup/customModule). Analyzes new upstream commits, classifies each by impact on TAU's customizations using a deterministic file-path → category map, and lets the user selectively cherry-pick chosen commits onto a verification branch with `npm run build` gating before opening a PR. Triggers when the user says "check upstream", "analyze upstream", "pull upstream commits ...", "skip upstream commit ...", or invokes `/upstream-analyze`, `/upstream-apply`, `/upstream-skip`.
---

# Upstream Sync Skill

This skill orchestrates pulling changes from `upstream/main` (`ExLibrisGroup/customModule`) into the TAU fork, with deterministic impact analysis and human-controlled selection.

**Reference:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md` is the source of truth for design decisions.

## Modes

The skill has four conversational modes. Pick the one that matches the user's intent:

| User intent | Mode | Section below |
|---|---|---|
| "let's check upstream", "analyze upstream", "/upstream-analyze" | **Analyze** | §1 |
| "pull commits A, B, C", "apply upstream commits ...", "/upstream-apply A B" | **Apply** | §2 |
| "skip commit A (because ...)" | **Skip** | §3 |
| (during Apply) cherry-pick reports a conflict | **Resolve** | §4 |

## Hard rules (apply to every mode)

- **Never push directly to `main`.** All upstream changes go through a `sync/upstream-<date>` branch and a PR.
- **Never auto-merge the PR.** The user reviews and merges manually.
- **Never proceed past a build failure or PR-creation failure.** Stop and report.
- **Never write to the ledger unless the full apply sequence (picks + build + push + PR) succeeded.** Atomic ledger writes only.
- **Delegate all git operations to the `git-expert` skill** (branch creation, commits, push, PR open). Invoke `Skill { skill: "git-expert" }` when you need its conventions.

## §1 — Analyze mode

**1.1 Fetch upstream:**
```bash
git fetch upstream
```
If this fails, stop and surface the error to the user.

**1.2 Determine cutoff:**
- Read `docs/upstream-sync/applied.json` (via `node scripts/upstream-sync/ledger.mjs list`).
- Take the latest entry with `decision: "applied"`. Its `sha` is the cutoff.
- If the ledger is empty, the cutoff is `git merge-base main upstream/main`.

**1.3 List candidate commits:**
```bash
git log --format=%H upstream/main ^main
```
This gives all upstream commits not yet on `main` (chronologically newest-first; reverse for oldest-first when reporting).

**1.4 Filter already-decided commits:**
For each candidate SHA:
- `node scripts/upstream-sync/ledger.mjs has-sha <full-sha>` — if it returns `applied` or `skipped`, drop it.
- Also check `git log main --format=%B | grep "cherry picked from commit <sha>"` — if found, drop it (already cherry-picked).

**1.5 Classify each remaining commit:**
```bash
node scripts/upstream-sync/classify.mjs <sha>
```
Parse the JSON output. You'll get `bucket`, `matchedCategories`, `changedFiles`, `recommendation`.

**1.6 Read the diff for an impact summary:**
```bash
git show --stat <sha>
git show <sha> -- <files-of-interest>  # for the categories that hit
```
Write a 1-3 line natural-language impact note: what the commit does, how it might interact with TAU's customizations in the matched categories. Be specific: reference TAU file paths or features by name when relevant. If you're not sure, say so.

**1.7 Write the report:**
File: `docs/upstream-sync/<YYYY-MM-DD>.md` (today's date in ISO format).

Use this exact template:

````markdown
# Upstream sync analysis — YYYY-MM-DD

**Range:** <merge-base sha-short> → upstream/main (<head sha-short>)
**New commits since last apply:** N (M clean, K owned-touch, J structural)

## Recommended action
<top-level guidance: "Pull all clean commits in one go; review the structural ones one at a time," or similar>

---

### <sha-short> — <commit subject>
- **Author:** <name>, **Date:** YYYY-MM-DD
- **Files touched:** <comma-separated list, truncate to ~10 with "(N more)" if longer>
- **Categories hit:** `category-a`, `category-b` *(or "none")*
- **Bucket:** clean | owned-touch | structural
- **Impact:** <1-3 lines>
- **Recommendation:** safe to pull | worth a look | needs review

### <next sha>
...
````

If the file already exists for today (re-running same day), overwrite it. Git history of the file preserves prior versions.

**1.8 Display the report in chat:**
After writing the file, paste the report contents into the conversation so the user can read it without opening the file. End with a one-line prompt: "Tell me which SHAs to pull (or skip)."

## §2 — Apply mode

**2.1 Parse the user's SHA list.**
The user gives short or full SHAs. Resolve each to full SHA via `git rev-parse <short>`. If any fail to resolve, stop and report.

**2.2 Pre-flight gates** (any failure → stop, report, do nothing):
- `git status --porcelain` is empty (working tree clean).
- Current branch is `main` (`git rev-parse --abbrev-ref HEAD`). If not, ask the user before switching.
- Each SHA exists in `upstream/main` (`git merge-base --is-ancestor <sha> upstream/main`).
- For each SHA, `node scripts/upstream-sync/ledger.mjs has-sha <sha>`:
  - `applied` → warn ("already applied, reapply intended?"). Wait for explicit yes.
  - `skipped` → warn ("you previously skipped this; override?"). Wait for explicit yes.
  - `none` → continue.
- Check the user's order against upstream's chronological order (`git log --format=%H upstream/main ^main` reversed). If they differ, present both orderings and ask: (a) auto-reorder to chronological [default], (b) proceed in user-specified order, (c) cancel.

**2.3 Create the branch** (delegate to git-expert):
- Branch name: `sync/upstream-<YYYY-MM-DD>`. If a branch with that name already exists, suffix `-2`, `-3`, etc.
- Branch off current `main`.

**2.4 Cherry-pick loop:**
For each SHA in the chosen order:
```bash
git cherry-pick -x <sha>
```
- Clean → continue to next SHA.
- Conflict → invoke **Resolve mode** (§4). Don't proceed without resolution.
- After the last SHA succeeds, fall through to step 2.5.

**2.5 Build verification:**
```bash
npm run build
```
- Pass → continue to step 2.6.
- Fail → **stop**. Show the last ~30 lines of build output. Do NOT push, do NOT update ledger. Suggest options: (a) `git revert HEAD` (drop the last cherry-pick), (b) hand-fix and re-run `npm run build`, (c) abort entirely (`git checkout main && git branch -D sync/upstream-<date>`).

**2.6 Update the ledger:**
For each successfully cherry-picked SHA:
```bash
node scripts/upstream-sync/ledger.mjs add \
  --sha <full-sha> \
  --decision applied \
  --subject "<commit subject>" \
  --appliedAt <YYYY-MM-DD> \
  --branch sync/upstream-<YYYY-MM-DD>
```
Then commit the ledger update on the branch:
```bash
git add docs/upstream-sync/applied.json
git commit -m "chore(upstream-sync): record applied commits"
```

**2.7 Push the branch and open a PR** (delegate to git-expert):
- Push: `git push -u origin sync/upstream-<YYYY-MM-DD>`
- PR title: `Sync from upstream: N commits (YYYY-MM-DD)` (where N is the count)
- PR body — use this template:

````markdown
## Upstream sync

**Source:** `ExLibrisGroup/customModule@<head-sha-short>` → fork `main`
**Date:** YYYY-MM-DD

### Cherry-picked commits

- `<sha>` — <subject>  *(impact: <copied from analysis>)*
- `<sha>` — <subject>  *(impact: ...)*

### Build status

✅ `npm run build` passed locally

### Review notes

<copy any "needs review" / "worth a look" notes from the analysis report>
````

**2.8 Hand off:**
Tell the user the PR URL, branch name, and that the ball is in their court for review and merge. Done.

## §3 — Skip mode

**3.1 Parse SHAs and reason.**
The user might say "skip aef3d33 — we don't want dark mode work." Capture the SHA list and the optional reason.

**3.2 Pre-flight:**
- Resolve each SHA to full via `git rev-parse`.
- For each, ensure no apply branch is currently mid-cherry-pick (`git status` should not show "You are currently cherry-picking"). If it does, refuse: "skip is decision-only; finish or abort the current apply first."
- Check `node scripts/upstream-sync/ledger.mjs has-sha <sha>`:
  - `applied` → refuse ("already applied; you can revert via PR but not skip after-the-fact").
  - `skipped` → no-op, inform user.
  - `none` → continue.

**3.3 Confirm with the user.**
List each SHA with its subject (`git log -1 --format='%h %s' <sha>`). Ask "skip these N commits? Reason will be: '<reason>'". Wait for explicit yes.

**3.4 Append ledger entries on `main`:**
```bash
git checkout main
for sha in <list>; do
  node scripts/upstream-sync/ledger.mjs add \
    --sha <sha> \
    --decision skipped \
    --subject "<one-line subject>" \
    --appliedAt <YYYY-MM-DD> \
    --reason "<reason or 'no reason given'>"
done
git add docs/upstream-sync/applied.json
git commit -m "chore(upstream-sync): mark <N> upstream commits as skipped"
```

**3.5 Confirm:**
"Marked N commits as skipped; they won't appear in the next analysis."

## §4 — Resolve mode (during Apply)

Invoked when `git cherry-pick` returns non-zero (conflict).

**4.1 Identify conflicting files:**
```bash
git diff --name-only --diff-filter=U
```

**4.2 For each conflicting file, walk the user through:**

Show:
1. The TAU version (`git show :2:<file>` or read the working file's HEAD-side block).
2. The upstream change (`git show :3:<file>` or the upstream-side block).
3. The conflict markers in context.

**Then propose a concrete merged version**, with reasoning. Example:
> "Upstream renamed `assetBase` → `publicPath` here. Your code reads `assetBase` in `prebuild.js:42` and `webpack.config.js:78`. I'd accept the rename and update those two readers. Here's the proposed merged file: <full file>. Apply it?"

If you can't form a confident proposal (upstream and TAU made conceptually different changes), say so: "I don't see a clean merge here. Recommend you resolve by hand or abort."

**4.3 User chooses per file:**
- **Accept** ("apply it") → write the proposed file, `git add <file>`, move to next conflicting file.
- **Edit** ("I'll fix it") → user opens file, edits, says "done" → run `git diff --check <file>` (catches stray markers); if clean, `git add <file>`, move on; if not clean, ask user to fix the markers.
- **Abort** → `git cherry-pick --abort`, ask before deleting the branch (`git branch -D sync/upstream-<date>` if user confirms), exit Resolve mode.

**4.4 After all files resolved:**
```bash
git cherry-pick --continue
```
Resume the Apply cherry-pick loop with the next SHA.

**4.5 Stickiness rule:**
After one resolved conflict in this Apply, if a *second* cherry-pick also conflicts, the default suggestion shifts to **abort the whole apply**. Tell the user: "Stacking resolutions across multiple commits is where silent merge bugs hide. I'd recommend aborting and treating these as a single manual merge, but you can override."

**4.6 `resolve --redo`:**
If during Resolve the user says "redo" / "that proposal was wrong":
```bash
git checkout -- <file>     # restore conflict-marker state
git reset HEAD <file>      # un-stage if previously added
```
Then re-enter the Resolve flow for that file.

## Failure handling cheat sheet

| Failure | Behavior |
|---|---|
| `git fetch upstream` fails | Stop, surface verbatim |
| `owned-files.json` missing/malformed | Stop, ask user to fix; no defaults |
| Ledger missing/malformed | Warn, treat as empty |
| Working tree dirty (Apply pre-flight) | Stop, list dirty files |
| Not on `main` (Apply pre-flight) | Ask before switching |
| SHA not in `upstream/main` | Stop, show valid range |
| `npm run build` fails | Stop, no push, no ledger write |
| `gh pr create` fails | Branch is pushed; report SHA list, offer manual PR |
| Cherry-pick conflict | Invoke Resolve (§4); default if user declines: abort |

## Operational notes

- The skill writes its own commits on the apply branch (e.g., the ledger update). These are not cherry-picks; the PR title's "N commits" count refers to the *cherry-picked* count, not total commits on the branch.
- All scripts live in `scripts/upstream-sync/`. Always invoke them via `node scripts/upstream-sync/<script>.mjs ...` from the repo root.
- Today's date for filenames/timestamps comes from `date -I` (ISO 8601).
- The legacy `.github/workflows/sync-fork.yml` exists but is no longer the recommended path — see its top-of-file note.
````

- [ ] **Step 2: Verify the SKILL.md frontmatter parses**

```bash
head -3 .claude/skills/upstream-sync/SKILL.md
```
Expected: starts with `---`, has `name:` and `description:` fields, ends with `---`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/upstream-sync/SKILL.md
git commit -m "feat(upstream-sync): add Claude Code skill definition"
```

---

## Task 12: Add legacy notice to existing GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/sync-fork.yml` (prepend a header comment)

- [ ] **Step 1: Add deprecation comment at top of workflow**

Open `.github/workflows/sync-fork.yml`. Above the `name:` line, add:

```yaml
# DEPRECATED: this workflow is superseded by the `upstream-sync` Claude Code skill.
# See `.claude/skills/upstream-sync/SKILL.md` and
# `docs/superpowers/specs/2026-05-06-upstream-sync-design.md`.
# The workflow is left in place for emergency use; prefer the skill.
```

- [ ] **Step 2: Verify the YAML still parses**

```bash
node -e "const yaml = require('fs').readFileSync('.github/workflows/sync-fork.yml','utf8'); console.log(yaml.split('\n').slice(0,8).join('\n'))"
```
Expected: prints the comment lines and the start of the workflow. (Comments are valid YAML; this only fails if you accidentally introduced a syntax error elsewhere.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sync-fork.yml
git commit -m "docs(upstream-sync): mark legacy sync-fork workflow as deprecated"
```

---

## Task 13: Add upstream-sync section to `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a section near the bottom**

Open `CLAUDE.md`. After the `## Resources` section, append:

```markdown

## Syncing with upstream ExLibris repo

The `upstream-sync` Claude Code skill (`.claude/skills/upstream-sync/SKILL.md`) handles pulling changes from `ExLibrisGroup/customModule`.

**To use:**
- "let's check upstream" → analyzes new upstream commits, writes a dated report under `docs/upstream-sync/`, classifies each commit by impact on TAU customizations.
- "pull commits A, B, C" → cherry-picks chosen SHAs onto a `sync/upstream-<date>` branch, runs `npm run build`, opens a PR.
- "skip commit A — we don't want X" → marks commits as decided-against so they stop appearing in future analyses.

The skill never pushes directly to `main` and never auto-merges PRs.

**Configuration:** `.upstream-sync/owned-files.json` lists TAU-customized files organized into categories with risk levels. Update this file when you take ownership of a new file or add a new feature area — the skill itself will suggest additions when it sees you skipping changes to files it considered "clean."

**Spec:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md`
```

- [ ] **Step 2: Verify file structure**

```bash
grep -A2 "Syncing with upstream" CLAUDE.md | head -5
```
Expected: shows the new heading and first line.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: reference upstream-sync skill in CLAUDE.md"
```

---

## Task 14: Add quick-reference README in `docs/upstream-sync/`

**Why:** Helps a teammate (or future you) understand what those JSON/markdown files are without having to read the full spec.

**Files:**
- Create: `docs/upstream-sync/README.md`

- [ ] **Step 1: Write the README**

Create `docs/upstream-sync/README.md`:

```markdown
# `docs/upstream-sync/`

Artifacts produced by the **`upstream-sync`** Claude Code skill (`.claude/skills/upstream-sync/SKILL.md`).

## What's here

- `applied.json` — the **decisions ledger**. Each entry records an upstream commit that was either applied (cherry-picked into the fork) or explicitly skipped, with a timestamp and (for skips) a reason. The skill reads this on every Analyze run to filter out already-decided commits.
- `<YYYY-MM-DD>.md` — **analysis reports** from each Analyze run. One file per day; running Analyze twice the same day overwrites that day's file (git history preserves prior versions).
- `README.md` — this file.

## Don't hand-edit `applied.json` lightly

The ledger is appended to atomically by the skill at the end of a successful apply. Hand-editing is supported (e.g., to remove a stale skip), but:

- Keep the JSON valid.
- Keep entries chronological.
- Required fields: `sha` (full), `decision` (`applied` | `skipped`), `appliedAt` (ISO date).

## Related

- **Skill:** `.claude/skills/upstream-sync/SKILL.md`
- **Config:** `.upstream-sync/owned-files.json`
- **Scripts:** `scripts/upstream-sync/`
- **Spec:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/upstream-sync/README.md
git commit -m "docs(upstream-sync): add README for docs/upstream-sync directory"
```

---

## Task 15: End-to-end smoke test (manual, with skill loaded)

**Why:** The unit tests verify the scripts in isolation; this verifies the skill orchestrates them correctly.

**Files:** None modified — this is a verification-only task.

- [ ] **Step 1: Reload Claude Code so the skill is picked up**

If you're running this plan inside Claude Code, the new SKILL.md needs to be loaded. Either restart the CC session, or the harness may auto-reload skills — confirm by typing `/help` and checking that `upstream-sync` appears (if it's exposed as a slash command) or by seeing it in the list of available skills.

- [ ] **Step 2: Trigger Analyze mode**

In a fresh chat with the project, say:
```
let's check upstream
```

Expected:
- Claude invokes the `upstream-sync` skill.
- It runs `git fetch upstream` (silent).
- It enumerates the 8 currently-pending upstream commits.
- It calls `node scripts/upstream-sync/classify.mjs` for each.
- It writes `docs/upstream-sync/<today>.md`.
- It pastes the report in chat.

Verify the report:
- All 8 commits are listed.
- Buckets and matched categories match what `historical-validation.test.mjs` produced.
- Impact notes are coherent (not generic).
- A summary line shows the count breakdown (M clean, K owned-touch, J structural).

- [ ] **Step 3: Pick one low-risk commit and run Apply mode**

Pick any commit from the report whose recommendation is `safe to pull` or `worth a look`. (If all 8 are `needs review`, pick the lowest-risk one and proceed with eyes open — the goal is to validate the pipeline, not to merge a risky change.)

Say:
```
pull commit <sha>
```

Expected:
- Pre-flight passes (clean tree, on main).
- A `sync/upstream-<today>` branch is created.
- `git cherry-pick -x <sha>` runs (may require Resolve flow if conflicts).
- `npm run build` runs and passes.
- The ledger is updated; ledger commit lands on the branch.
- The branch is pushed to `origin`.
- A PR is opened with the templated title and body.

- [ ] **Step 4: Verify the artifacts**

```bash
git log sync/upstream-<today> --oneline | head -5
node scripts/upstream-sync/ledger.mjs list
gh pr list --head sync/upstream-<today>
```

Expected:
- Cherry-picked commit is present with the `cherry picked from commit <sha>` footer.
- Ledger entry exists with `decision: "applied"`.
- PR is open against `main`.

- [ ] **Step 5: Decide what to do with the PR**

If the cherry-picked commit is genuinely a useful upstream change you want, review the PR and merge it. Otherwise, close the PR without merging and delete the branch:
```bash
gh pr close <pr-number>
git push origin --delete sync/upstream-<today>
git checkout main && git branch -D sync/upstream-<today>
```

The smoke-test ledger entry stays — that's intentional, it documents that you tried it.

- [ ] **Step 6: Document any rough edges**

If anything in the smoke test surfaced a bug or rough edge in the skill, file a follow-up note (in the spec or as a TODO at the top of SKILL.md). Common things to check:
- Were the impact notes good enough to be actionable, or too generic?
- Did the report formatting render well in chat?
- Was the SHA list parsing tolerant of typos / extra whitespace?
- Were the pre-flight error messages clear enough?

If the smoke test passed cleanly, this task is done — no commit required.

---

## Validation checklist (before declaring done)

- [ ] All node:test tests pass (`npm run test:upstream-sync`).
- [ ] `node scripts/upstream-sync/classify.mjs <known-sha>` returns sensible JSON.
- [ ] `node scripts/upstream-sync/ledger.mjs list` runs without error.
- [ ] `.upstream-sync/owned-files.json` parses and covers all known TAU-customized areas (validated by `historical-validation.test.mjs`).
- [ ] `.claude/skills/upstream-sync/SKILL.md` exists and has valid frontmatter.
- [ ] Smoke test (Task 15) completed end-to-end at least once.
- [ ] `CLAUDE.md` references the skill.
- [ ] `.github/workflows/sync-fork.yml` has the legacy notice.

When all are checked, the skill is ready for routine use. Recommended cadence: **monthly**, or on demand when you know upstream has shipped something interesting.
