import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkTrackingBuild } from '../check-tracking-build.mjs';
import { writeTrackingToken } from '../write-tracking-token.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
function fixture(t, view = 'NDE') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tracking-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src/app/state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build-settings.env'), `VIEW_ID=${view}\n`);
  return root;
}
const synthetic = { TAU_MIXPANEL_TOKEN: 'SyntheticProject123' };
const disabled = { npm_config_tau_check: 'true', npm_config_tau_tracking_disabled: 'true' };

test('both tracking views reject absent, blank and invalid inputs without leaking values', t => {
  for (const view of ['NDE', 'NDE_TEST']) {
    const root = fixture(t, view);
    for (const value of [undefined, '', '  ', 'Synthetic-invalid!']) {
      assert.throws(() => checkTrackingBuild({ root, env: { TAU_MIXPANEL_TOKEN: value } }), error => {
        assert.match(error.message, /requires valid TAU_MIXPANEL_TOKEN/);
        assert.ok(!error.message.includes('Synthetic-invalid!'));
        return true;
      });
    }
    checkTrackingBuild({ root, env: synthetic });
  }
});

test('standalone generation overwrites stale configuration; build checks generated state', t => {
  const root = fixture(t);
  const messages = [];
  const log = line => messages.push(line);
  writeTrackingToken({ root, env: synthetic, log });
  checkTrackingBuild({ root, env: synthetic, generated: true });
  assert.throws(() => checkTrackingBuild({ root, env: {} }), /requires valid/);
  writeTrackingToken({ root, env: {}, log });
  assert.throws(() => checkTrackingBuild({ root, env: synthetic, generated: true }), /requires valid/);
  assert.ok(messages.every(line => !line.includes(synthetic.TAU_MIXPANEL_TOKEN)));
  fs.writeFileSync(path.join(root, 'src/app/state/tracking.generated.ts'), 'malformed');
  assert.throws(() => checkTrackingBuild({ root, env: synthetic, generated: true }), /invalid generated/);
  fs.unlinkSync(path.join(root, 'src/app/state/tracking.generated.ts'));
  assert.throws(() => checkTrackingBuild({ root, env: synthetic, generated: true }), /Missing/);
});


test('enabled builds reject stale nonempty generated configuration with status-only errors', t => {
  for (const view of ['NDE', 'NDE_TEST']) {
    const root = fixture(t, view);
    const old = { TAU_MIXPANEL_TOKEN: 'SyntheticOldProject' };
    const current = { TAU_MIXPANEL_TOKEN: 'SyntheticNewProject' };
    writeTrackingToken({ root, env: old, log: () => {} });
    for (const env of [current, {}, { TAU_MIXPANEL_TOKEN: 'Synthetic-invalid!' }]) {
      assert.throws(() => checkTrackingBuild({ root, env, generated: true }), error => {
        assert.match(error.message, /does not match valid current build input/);
        for (const value of [old.TAU_MIXPANEL_TOKEN, current.TAU_MIXPANEL_TOKEN, 'Synthetic-invalid!']) {
          assert.ok(!error.message.includes(value));
        }
        return true;
      });
    }
  }
});

test('matching generated configuration uses the same normalization as generation', t => {
  for (const view of ['NDE', 'NDE_TEST']) {
    const root = fixture(t, view);
    const padded = { TAU_MIXPANEL_TOKEN: '  SyntheticProject123 \n' };
    writeTrackingToken({ root, env: padded, log: () => {} });
    checkTrackingBuild({ root, env: synthetic, generated: true });
    checkTrackingBuild({ root, env: padded, generated: true });
  }
});

test('disabled packages require explicit verification intent and embed empty configuration', t => {
  const root = fixture(t);
  assert.throws(() => checkTrackingBuild({ root, env: { npm_config_tau_tracking_disabled: 'true' } }), /requires build:check/);
  assert.throws(() => checkTrackingBuild({ root, env: { npm_config_tau_check: 'true' } }), /requires valid/);
  writeTrackingToken({ root, env: { ...synthetic, ...disabled }, log: () => {} });
  checkTrackingBuild({ root, env: disabled, generated: true });
  checkTrackingBuild({ root, env: { ...synthetic, ...disabled }, generated: true });
  checkTrackingBuild({ root, env: { ...disabled, TAU_MIXPANEL_TOKEN: 'Synthetic-invalid!' }, generated: true });
  checkTrackingBuild({ root, env: disabled });
  writeTrackingToken({ root, env: synthetic, log: () => {} });
  assert.throws(() => checkTrackingBuild({ root, env: disabled, generated: true }), /must embed an empty/);
});

test('TMA family remains token-optional; undeclared views still fail', t => {
  for (const view of ['TMA', 'TMA_NDE']) {
    const root = fixture(t, view);
    checkTrackingBuild({ root, env: {} });
    checkTrackingBuild({ root, env: {}, generated: true });
  }
  assert.throws(() => checkTrackingBuild({ root: fixture(t, 'UNDECLARED'), env: {} }), /Unknown VIEW_ID/);
});

test('real npm lifecycle wiring stops compilation and packaging, and propagates verification flags', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  for (const name of ['check-tracking-build.mjs', 'write-tracking-token.mjs', 'select-view.mjs', 'view-changes.mjs']) {
    fs.copyFileSync(path.join(repo, 'scripts', name), path.join(root, 'scripts', name));
  }
  const original = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).scripts;
  // Exercise real lifecycle gates; substitute generation/compile/package markers only.
  const scripts = {
    prebuild: original.prebuild, postbuild: original.postbuild,
    'build:check': original['build:check'],
    generate: 'node scripts/write-tracking-token.mjs',
    build: 'node marker.cjs compile',
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }));
  fs.writeFileSync(path.join(root, 'marker.cjs'), "require('fs').appendFileSync('steps', process.argv[2] + '\\n')");
  fs.writeFileSync(path.join(root, 'postbuild.js'), "require('fs').appendFileSync('steps', process.env.npm_config_tau_check ? 'verification\\n' : 'package\\n')");
  // Deliberately minimal environment: never inherit real token values or npm flags.
  const env = { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: root };
  const run = (args, extra = {}) => spawnSync('npm', args, { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' });
  assert.notEqual(run(['run', 'build']).status, 0);
  assert.equal(fs.existsSync(path.join(root, 'steps')), false);
  assert.notEqual(run(['run', 'build', '--tau-tracking-disabled']).status, 0);
  assert.equal(fs.existsSync(path.join(root, 'steps')), false);
  const enabled = run(['run', 'build'], synthetic);
  assert.equal(enabled.status, 0, enabled.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'steps'), 'utf8'), 'compile\npackage\n');
  fs.unlinkSync(path.join(root, 'steps'));
  // A generation regression must stop the lifecycle before the compile marker.
  const badScripts = { ...scripts, generate: 'node scripts/write-tracking-token.mjs' };
  fs.writeFileSync(path.join(root, 'clear.cjs'), "require('fs').writeFileSync('src/app/state/tracking.generated.ts', \"export const mixpanelProjectToken = '';\\n\")");
  badScripts.generate = 'node clear.cjs';
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: badScripts }));
  assert.notEqual(run(['run', 'build'], synthetic).status, 0);
  assert.equal(fs.existsSync(path.join(root, 'steps')), false);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts }));
  const verification = run(['run', 'build:check', '--', '--tau-tracking-disabled']);
  assert.equal(verification.status, 0, verification.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'steps'), 'utf8'), 'compile\nverification\n');
  fs.unlinkSync(path.join(root, 'steps'));
  const directPost = run(['run', 'postbuild']);
  assert.notEqual(directPost.status, 0);
  assert.equal(fs.existsSync(path.join(root, 'steps')), false);
});
