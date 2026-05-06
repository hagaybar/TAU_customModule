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
