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
  assert.equal(archiveRoot(repo), path.join(parent, 'tau-packages'));
});

test('a worktree archives beside the main checkout, not inside the worktree', () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'archive-')));
  const repo = path.join(parent, 'TAU_customModule');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const worktree = path.join(repo, '.claude', 'worktrees', 'x');
  git(repo, 'worktree', 'add', '-q', worktree);
  assert.equal(archiveRoot(worktree), path.join(parent, 'tau-packages'));
});

test('outside git it falls back to ~/tau-packages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-'));
  assert.equal(archiveRoot(dir), path.join(os.homedir(), 'tau-packages'));
});
