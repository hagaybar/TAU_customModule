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
