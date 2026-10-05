const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const archiver = require('archiver');
require('dotenv').config({ path: './build-settings.env' });

const distPath = path.join(__dirname, 'dist', 'custom-module');
const targetPath = path.join(__dirname, 'dist', `${process.env.INST_ID}-${process.env.VIEW_ID}`);
const zipPath = path.join(__dirname, 'dist', `${process.env.INST_ID}-${process.env.VIEW_ID}.zip`);

/**
 * Every build is also archived to ~/tau-packages/, stamped with the commit it came
 * from. `dist/` is overwritten by the next build, so without this the only record of
 * what was uploaded to Alma is whatever anyone happened to copy somewhere by hand —
 * which is how you end up unable to answer "which source produced the package that is
 * live?" months later.
 *
 * The commit SHA is the point. A stamped zip maps back to reproducible source; a
 * `-dirty` suffix means the tree had uncommitted changes and the package therefore
 * cannot be rebuilt exactly. Treat -dirty packages as throwaway.
 */
/**
 * Verification builds go somewhere else entirely.
 *
 * Proving a change did not disturb another view means building that view's package purely
 * to diff it (see scripts/compare-packages.mjs). Those packages are never uploaded — but
 * dropped next to the real ones they are indistinguishable from them, and an archive whose
 * whole purpose is answering "which source produced the package that is live?" cannot
 * afford entries that were never candidates.
 *
 * So `npm run build:check` puts them under tau-packages/verification/ with their own
 * manifest, and the top-level archive keeps meaning "a package that could be deployed".
 *
 * The flag arrives as npm_config_tau_check: npm turns `--tau-check` on a run command into
 * that environment variable, for pre/post scripts too, on every platform. An env var like
 * TAU_CHECK=1 would not survive cmd.exe.
 */
const IS_CHECK_BUILD = Boolean(process.env.npm_config_tau_check);
const ARCHIVE_DIR = IS_CHECK_BUILD
  ? path.join(os.homedir(), 'tau-packages', 'verification')
  : path.join(os.homedir(), 'tau-packages');
const MANIFEST = path.join(ARCHIVE_DIR, 'MANIFEST.tsv');
// `note` is written empty and filled in by hand — a build is not a deploy, and postbuild
// cannot know which packages were actually uploaded to Alma. Record that there.
const MANIFEST_HEADER = 'built_utc\tview\tcommit\tdirty\tbytes\tfile\tnote\n';

/**
 * Selecting a view means editing these files, so they are not evidence that the source
 * changed. Counting them would mark every NDE_TEST package dirty and train everyone to
 * ignore the warning.
 *
 * view.generated.ts is written by scripts/select-view.mjs and names the selected family.
 * The per-view assets it also generates (src/assets/css/custom.css and friends) are
 * gitignored rather than listed here — see the "Per-view generated files" block in
 * .gitignore for why a tracked copy of those would be a production hazard.
 */
const VIEW_SELECTION_FILES = [
  'build-settings.env',
  'src/app/state/asset-base.generated.ts',
  'src/app/state/view.generated.ts',
];

function gitInfo() {
  // Deliberately NOT trimmed: porcelain lines start with a two-character status field that
  // is often ' M', and trimming the whole output eats the leading space of the first line
  // only, so a positional parse then mangles exactly one path and silently misses it.
  const run = (args) =>
    execFileSync('git', args, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const changed = run(['status', '--porcelain'])
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(/^\s*\S{1,2}\s+/, '').trim())
      .filter((file) => !VIEW_SELECTION_FILES.includes(file));
    return { commit: run(['rev-parse', '--short', 'HEAD']).trim(), dirty: changed.length > 0 };
  } catch {
    // Not a git checkout, or git unavailable — archive anyway, just unattributed.
    return { commit: 'nogit', dirty: false };
  }
}

function archiveBuild() {
  try {
    const { commit, dirty } = gitInfo();
    const now = new Date();
    // 2026-09-03T08:11:35.899Z -> 20260903T081135Z, so filenames sort chronologically.
    const stamp = now.toISOString().replace(/[:-]/g, '').replace(/\.\d+Z$/, 'Z');
    const day = now.toISOString().slice(0, 10); // UTC date, matching the stamp
    const view = `${process.env.INST_ID}-${process.env.VIEW_ID}`;
    const name = `${view}_${stamp}_${commit}${dirty ? '-dirty' : ''}.zip`;
    const relative = `${day}/${name}`;
    const dest = path.join(ARCHIVE_DIR, day, name);

    if (IS_CHECK_BUILD) {
      console.log('Verification build — archiving to tau-packages/verification/. Not for upload.');
    }
    fs.mkdirSync(path.join(ARCHIVE_DIR, day), { recursive: true });
    fs.copyFileSync(zipPath, dest);

    const bytes = fs.statSync(dest).size;
    if (!fs.existsSync(MANIFEST)) fs.writeFileSync(MANIFEST, MANIFEST_HEADER);
    fs.appendFileSync(
      MANIFEST,
      `${now.toISOString().replace(/\.\d+Z$/, 'Z')}\t${process.env.VIEW_ID}\t${commit}\t${dirty ? 'yes' : 'no'}\t${bytes}\t${relative}\t\n`
    );

    console.log(`Archived to ${dest}`);
    if (dirty) {
      console.log('  ⚠ Tree was dirty — this package cannot be rebuilt from a commit. Do not upload it.');
    }
  } catch (err) {
    // Archiving is a convenience. A failure here must never fail the build.
    console.log(`Warning: could not archive the package (${err.message}). The zip in dist/ is unaffected.`);
  }
}

function removeDirectory(directory, callback) {
    fs.rm(directory, { recursive: true, force: true }, callback);
}

/**
 * The per-view sources under src/assets/views/ are how a build chooses its content; they
 * are not content themselves. angular.json copies src/assets wholesale, so without this
 * every package would also carry a second copy of its own six host-fetched files plus the
 * other family's — inert, because Primo only ever requests the fixed paths, but it makes
 * a package's file list differ from a pre-#67 one for no reason, which is exactly the
 * noise that trains people to skim a package comparison instead of reading it.
 *
 * Done here rather than by filtering in angular.json: that file is byte-identical to
 * upstream/main, and one edit would make it conflict on every upstream change forever.
 * postbuild.js already diverges from upstream, so this costs no new conflict surface.
 */
function stripPerViewSources(root) {
    const viewsDir = path.join(root, 'assets', 'views');
    if (!fs.existsSync(viewsDir)) return;
    fs.rmSync(viewsDir, { recursive: true, force: true });
    console.log('Removed assets/views/ from the package (build-time sources, not shipped content)');
}

function renameAndArchive() {
    fs.rename(distPath, targetPath, (err) => {
        if (err) throw err;
        console.log(`Renamed directory to ${targetPath}`);

        stripPerViewSources(targetPath);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`Archive completed: ${archive.pointer()} total bytes`);
            console.log(`Zip file created at: ${zipPath}`);
            archiveBuild();
            console.log('Please upload the zip file to Alma BO custom package section to deploy your custom module.');
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.log('Warning:', err);
            } else {
                throw err;
            }
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(targetPath, path.basename(targetPath)); // This ensures the directory itself is included
        archive.finalize();
    });
}

// Check if target directory exists and remove it if it does
if (fs.existsSync(targetPath)) {
    removeDirectory(targetPath, (err) => {
        if (err) throw err;
        renameAndArchive();
    });
} else {
    renameAndArchive();
}
