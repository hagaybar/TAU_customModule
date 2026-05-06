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
