/**
 * compare-packages.mjs — does this package still contain what the last one contained?
 *
 * The per-view build (scripts/select-view.mjs) decides the *contents of the zip* before
 * `ng build` runs. So every way it can hurt a live view is a way the zip can come out
 * wrong: a file not copied, a stale file not deleted, the wrong family selected, or a
 * file copied with a byte changed. All four are invisible in the browser until someone
 * happens to look at the exact page that uses that file.
 *
 * This compares two packages instead. There is no model of a "correct" package here — the
 * baseline *is* a real package built from the commit you are comparing against, so the
 * thing being trusted is an artifact, not a rule someone wrote down.
 *
 * Usage:
 *   node scripts/compare-packages.mjs <baseline.zip> <candidate.zip>
 *   npm run compare:packages -- <baseline.zip> <candidate.zip>
 *
 * Exit code 0 means nothing the host fetches changed. Exit 1 means something did, and the
 * output names it. Exit 2 means the comparison itself could not be trusted.
 *
 * ## Why it refuses to compare nothing
 *
 * The dangerous failure of a checker like this is not a wrong answer — it is a confident
 * "no differences" produced by comparing two empty sets. The first draft of this script
 * hand-listed the eight files to check, got the path prefix wrong, printed "absent from
 * both" eight times, and still exited 0. It would have passed a package with no stylesheet
 * at all.
 *
 * So: nothing is hand-listed. Every file in either package is compared, the interesting
 * ones are picked out by where they live, and the run aborts (exit 2) if either package
 * looks too small to be real or has no files under assets/. A check that cannot fail is
 * not a check.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * A package with fewer files than this is not a build — it is a failed unzip, the wrong
 * argument, or a truncated download. Real packages hold ~57 files.
 */
export const MIN_PLAUSIBLE_FILES = 20;

/**
 * Everything the Primo host fetches by URL lives under assets/. That is the rule, rather
 * than a list of filenames, precisely so a file nobody remembered is still covered.
 *
 * assets/views/ is the exception: it holds every family's *sources*, which ship in every
 * package by design (angular.json copies src/assets wholesale). A TMA source appearing in
 * the NDE package is expected and harmless — the host only ever fetches the fixed path.
 */
export function isHostFetched(relPath) {
  return relPath.startsWith('assets/') && !relPath.startsWith('assets/views/');
}

/** Read every file under `dir` as relPath -> Buffer. */
export function readTree(dir, prefix = '', out = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readTree(full, rel, out);
    else out.set(rel, fs.readFileSync(full));
  }
  return out;
}

export class UntrustworthyComparison extends Error {
  constructor(message) {
    super(message);
    this.name = 'UntrustworthyComparison';
  }
}

function assertPlausible(label, tree) {
  if (tree.size < MIN_PLAUSIBLE_FILES) {
    throw new UntrustworthyComparison(
      `${label} holds only ${tree.size} file(s); a real package holds dozens. ` +
        `Refusing to report "no differences" from a comparison that checked nothing.`,
    );
  }
  const hostFetched = [...tree.keys()].filter(isHostFetched);
  if (hostFetched.length === 0) {
    throw new UntrustworthyComparison(
      `${label} has no files under assets/ outside assets/views/. ` +
        `Either the package is broken or this script is looking at the wrong directory.`,
    );
  }
}

/**
 * Compare two already-extracted packages.
 *
 * `blocking` is what must not change: anything the host fetches. `informational` is
 * everything else — the compiled bundle, whose filenames carry content hashes and whose
 * chunk ids shift whenever the module graph does. Those differences are normal and are
 * reported without failing, so that a real regression is never buried in noise.
 */
export function comparePackages(baseline, candidate) {
  assertPlausible('baseline', baseline);
  assertPlausible('candidate', candidate);

  const all = [...new Set([...baseline.keys(), ...candidate.keys()])].sort();
  const blocking = [];
  const informational = [];

  for (const rel of all) {
    const a = baseline.get(rel);
    const b = candidate.get(rel);
    let kind;
    if (a && !b) kind = 'removed';
    else if (!a && b) kind = 'added';
    else if (!a.equals(b)) kind = 'changed';
    else continue;

    const entry = { path: rel, kind, baselineBytes: a?.length ?? null, candidateBytes: b?.length ?? null };
    (isHostFetched(rel) ? blocking : informational).push(entry);
  }

  const hostFetchedChecked = [...baseline.keys()].filter(isHostFetched).length;
  return { blocking, informational, filesCompared: all.length, hostFetchedChecked };
}

function unzipTo(zipPath, dest) {
  if (!fs.existsSync(zipPath)) throw new UntrustworthyComparison(`No such package: ${zipPath}`);
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', dest], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    throw new UntrustworthyComparison(`Could not unzip ${zipPath}: ${error.message}`);
  }
  // Each package unzips to a single <INST_ID>-<VIEW_ID>/ directory.
  const entries = fs.readdirSync(dest, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (entries.length !== 1) {
    throw new UntrustworthyComparison(
      `Expected exactly one top-level directory in ${path.basename(zipPath)}, found ${entries.length}.`,
    );
  }
  return path.join(dest, entries[0].name);
}

export function comparePackageZips(baselineZip, candidateZip) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-packages-'));
  try {
    const a = readTree(unzipTo(baselineZip, path.join(work, 'baseline')));
    const b = readTree(unzipTo(candidateZip, path.join(work, 'candidate')));
    return comparePackages(a, b);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

export function report(result, log = console.log) {
  const { blocking, informational, filesCompared, hostFetchedChecked } = result;

  log(`Compared ${filesCompared} file(s); ${hostFetchedChecked} of them host-fetched.`);
  log('');

  if (blocking.length === 0) {
    log('✔ Nothing the host fetches changed.');
  } else {
    log(`✖ ${blocking.length} host-fetched file(s) changed — this is a regression, not an improvement:`);
    for (const d of blocking) {
      log(`    ${d.kind.padEnd(7)} ${d.path}  (${d.baselineBytes ?? '—'} → ${d.candidateBytes ?? '—'} bytes)`);
    }
  }

  log('');
  if (informational.length === 0) {
    log('  Bundle and everything else: identical.');
  } else {
    log(`  ${informational.length} other file(s) differ (bundle hashes and chunk ids shift whenever`);
    log('  the module graph does; these do not fail the check):');
    for (const d of informational) {
      log(`    ${d.kind.padEnd(7)} ${d.path}  (${d.baselineBytes ?? '—'} → ${d.candidateBytes ?? '—'} bytes)`);
    }
  }

  return blocking.length === 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [baselineZip, candidateZip] = process.argv.slice(2);
  if (!baselineZip || !candidateZip) {
    console.error(
      'Usage: node scripts/compare-packages.mjs <baseline.zip> <candidate.zip>\n' +
        '\n' +
        'Build the baseline from the commit you are comparing against (usually main), and\n' +
        'the candidate from your branch, with the SAME VIEW_ID. Packages are archived to\n' +
        '~/tau-packages/<date>/ automatically.',
    );
    process.exit(2);
  }
  try {
    const ok = report(comparePackageZips(baselineZip, candidateZip));
    process.exit(ok ? 0 : 1);
  } catch (error) {
    if (error instanceof UntrustworthyComparison) {
      console.error(`✖ Comparison aborted — its answer could not be trusted.\n  ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
}
