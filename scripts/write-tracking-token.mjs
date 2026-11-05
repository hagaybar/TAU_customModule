/** Generate tracking configuration from TAU_MIXPANEL_TOKEN, never retaining old values.
 * Separate from upstream-owned prebuild.js. Standalone generation can disable tracking;
 * package builds are gated. Diagnostics report status only, never values or lengths.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { disabledBuild, normalizedTrackingToken } from './check-tracking-build.mjs';

export function writeTrackingToken({ root, env, log = console.log }) {
  const disabled = disabledBuild(env);
  const token = disabled ? '' : normalizedTrackingToken(env);
  fs.writeFileSync(path.join(root, 'src/app/state/tracking.generated.ts'),
    '// GENERATED from TAU_MIXPANEL_TOKEN; gitignored; do not edit or commit.\n' +
    `export const mixpanelProjectToken = '${token}';\n`);
  log(`Usage tracking: ${token ? 'enabled (token set)' : 'disabled (token empty)'}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeTrackingToken({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), env: process.env });
}
