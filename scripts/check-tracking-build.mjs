/** Build-only validation. Never loads credential files or reports token values. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readViewId, familyFor } from './select-view.mjs';

export const flag = value => value === 'true' || value === '1';
export function normalizedTrackingToken(env) {
  const raw = (env.TAU_MIXPANEL_TOKEN || '').trim();
  return /^[A-Za-z0-9]+$/.test(raw) ? raw : '';
}
export function disabledBuild(env) {
  const disabled = flag(env.npm_config_tau_tracking_disabled);
  if (disabled && !flag(env.npm_config_tau_check)) {
    throw new Error('--tau-tracking-disabled requires build:check; disabled packages are not for upload.');
  }
  return disabled;
}
export function checkTrackingBuild({ root, env, generated = false }) {
  const view = readViewId(fs.readFileSync(path.join(root, 'build-settings.env'), 'utf8'));
  familyFor(view);
  const disabled = disabledBuild(env);
  if (!['NDE', 'NDE_TEST'].includes(view)) return;
  const input = disabled ? '' : normalizedTrackingToken(env);
  let tokenSet;
  let generatedToken;
  if (generated) {
    const file = path.join(root, 'src/app/state/tracking.generated.ts');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const match = text.match(/^export const mixpanelProjectToken = '([A-Za-z0-9]*)';$/m);
    if (!match) throw new Error('Missing or invalid generated tracking configuration; run the complete build workflow.');
    generatedToken = match[1];
    tokenSet = !!generatedToken;
  } else {
    tokenSet = !!input;
  }
  if (disabled) {
    if (generated && tokenSet) throw new Error('Tracking-disabled verification build must embed an empty token.');
    return;
  }
  if (generated && tokenSet && generatedToken !== input) {
    throw new Error('Generated tracking configuration does not match valid current build input; regenerate through the complete build workflow.');
  }
  if (!tokenSet) throw new Error(`${view} package requires valid TAU_MIXPANEL_TOKEN configuration. For intentional tracking-disabled development packages use npm run build:check -- --tau-tracking-disabled.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkTrackingBuild({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), env: process.env, generated: process.argv.includes('--generated') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
