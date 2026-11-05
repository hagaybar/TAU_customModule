import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import packageArchive from '../package-archive.cjs';

const { archiveRoot } = packageArchive;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });

test('the archive sits beside the main checkout', () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'archive-')));
  const repo = path.join(parent, 'TAU_customModule');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  assert.equal(archiveRoot(repo, {}), path.join(parent, 'tau-packages'));
});

test('a worktree archives beside the main checkout, not inside the worktree', () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'archive-')));
  const repo = path.join(parent, 'TAU_customModule');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const worktree = path.join(repo, '.claude', 'worktrees', 'x');
  git(repo, 'worktree', 'add', '-q', worktree);
  assert.equal(archiveRoot(worktree, {}), path.join(parent, 'tau-packages'));
});

test('outside git it falls back to ~/tau-packages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-'));
  assert.equal(archiveRoot(dir, {}), path.join(os.homedir(), 'tau-packages'));
});


test('absolute override selects the root without writing there', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-override-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const destination = path.join(root, 'not-created', 'tau-packages');
  assert.equal(archiveRoot(root, { TAU_PACKAGE_ARCHIVE_ROOT: destination }), destination);
  assert.equal(fs.existsSync(destination), false);
  assert.equal(path.join(archiveRoot(root, { TAU_PACKAGE_ARCHIVE_ROOT: destination }), 'verification'), path.join(destination, 'verification'));
});

test('override takes precedence over git-derived location', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-override-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  const destination = path.join(root, 'chosen');
  assert.equal(archiveRoot(root, { TAU_PACKAGE_ARCHIVE_ROOT: destination }), destination);
});

test('invalid overrides fail rather than silently selecting another archive', () => {
  for (const value of ['', '   ', 'relative/path', './tau-packages', null]) {
    assert.throws(() => archiveRoot(os.tmpdir(), { TAU_PACKAGE_ARCHIVE_ROOT: value }), /nonempty absolute path/);
  }
});
