/**
 * package-archive.cjs — where built packages are archived.
 *
 * The archive is `tau-packages/` BESIDE the repository's main checkout:
 *
 *     ~/agent-work/TAU_customModule   <- the repo
 *     ~/agent-work/tau-packages       <- the archive
 *
 * It used to be ~/tau-packages, but builds run in two places with two different home
 * directories: WSL (/home/hagaybar) and the sandbox (/home/agent). The sandbox's home is not
 * visible from Windows, is not backed up, and is lost when the sandbox is deleted, so a
 * package built there was effectively invisible. ~/agent-work is the one folder both
 * environments share, restic backs it up, and Windows Explorer can browse it.
 *
 * Resolved from git's common dir, not from this file's location, so a build in a worktree
 * (.claude/worktrees/<name>/) still archives next to the main checkout rather than inside
 * the worktree, where it would be deleted along with it.
 *
 * CommonJS because postbuild.js is CommonJS; the .mjs scripts import it as a default.
 */
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function archiveRoot(repoDir) {
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // <parent>/TAU_customModule/.git -> <parent>/tau-packages
    return path.join(path.dirname(path.dirname(commonDir)), 'tau-packages');
  } catch {
    // Not a git checkout (e.g. an unpacked source zip) — the old location, so the build
    // still archives somewhere predictable.
    return path.join(os.homedir(), 'tau-packages');
  }
}

module.exports = { archiveRoot };
