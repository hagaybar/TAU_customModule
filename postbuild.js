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
const ARCHIVE_DIR = path.join(os.homedir(), 'tau-packages');
const MANIFEST = path.join(ARCHIVE_DIR, 'MANIFEST.tsv');
const MANIFEST_HEADER = 'built_utc\tview\tcommit\tdirty\tbytes\tfile\n';

/**
 * Selecting a view means editing these two files, so they are not evidence that the
 * source changed. Counting them would mark every NDE_TEST package dirty and train
 * everyone to ignore the warning.
 */
const VIEW_SELECTION_FILES = ['build-settings.env', 'src/app/state/asset-base.generated.ts'];

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
    // 2026-09-03T08:11:35.899Z -> 20260903T081135Z, so filenames sort chronologically.
    const stamp = new Date().toISOString().replace(/[:-]/g, '').replace(/\.\d+Z$/, 'Z');
    const view = `${process.env.INST_ID}-${process.env.VIEW_ID}`;
    const name = `${view}_${stamp}_${commit}${dirty ? '-dirty' : ''}.zip`;
    const dest = path.join(ARCHIVE_DIR, name);

    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    fs.copyFileSync(zipPath, dest);

    const bytes = fs.statSync(dest).size;
    if (!fs.existsSync(MANIFEST)) fs.writeFileSync(MANIFEST, MANIFEST_HEADER);
    fs.appendFileSync(
      MANIFEST,
      `${new Date().toISOString()}\t${process.env.VIEW_ID}\t${commit}\t${dirty ? 'yes' : 'no'}\t${bytes}\t${name}\n`
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

function renameAndArchive() {
    fs.rename(distPath, targetPath, (err) => {
        if (err) throw err;
        console.log(`Renamed directory to ${targetPath}`);

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
