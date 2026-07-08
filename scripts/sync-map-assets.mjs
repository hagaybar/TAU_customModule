#!/usr/bin/env node
/**
 * Sync the CenLib Shelf Map's bundled fallback assets from CloudFront.
 *
 * Downloads the current `mapping.csv` and floor SVGs into
 * `src/assets/cenlib-map/` so they ship inside the custom package and can serve
 * as a same-origin fallback when the CDN is unreachable (see
 * `services/map-asset-fallback.ts`). Run it deliberately before a deploy, then
 * commit the refreshed snapshot.
 *
 *   npm run sync:map-assets
 *
 * The snapshot is only a fallback: staleness is acceptable, but re-running this
 * before a package build keeps it close to the live data. CDN base + floor list
 * mirror `src/app/custom1-module/cenlib-map/config/data-source.config.ts`.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const AWS_CDN_BASE_URL = 'https://d3h8i7y9p8lyw7.cloudfront.net';
const FLOORS = [0, 1, 2];

// CDN path -> local filename (under src/assets/cenlib-map/). Lowercase to match
// the CDN naming and cdnAssetToLocalPath() in the addon.
const ASSETS = [
  { url: `${AWS_CDN_BASE_URL}/data/mapping.csv`, file: 'mapping.csv' },
  ...FLOORS.map((n) => ({
    url: `${AWS_CDN_BASE_URL}/maps/floor_${n}.svg`,
    file: `floor_${n}.svg`,
  })),
];

const OUT_DIR = fileURLToPath(new URL('../src/assets/cenlib-map/', import.meta.url));

async function download({ url, file }) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`);
  }
  const body = await res.text();
  await writeFile(new URL(file, `file://${OUT_DIR}`), body, 'utf8');
  console.log(`  ✓ ${file.padEnd(14)} ${body.length.toLocaleString()} bytes  (${url})`);
}

async function main() {
  console.log(`Syncing CenLib map fallback assets into ${OUT_DIR}`);
  await mkdir(OUT_DIR, { recursive: true });
  for (const asset of ASSETS) {
    await download(asset);
  }
  console.log('\nDone. Review, then commit the refreshed snapshot:');
  console.log('  git add src/assets/cenlib-map/ && git commit -m "chore(cenlib-map): refresh bundled fallback snapshot"');
}

main().catch((err) => {
  console.error(`\nsync-map-assets failed: ${err.message}`);
  process.exit(1);
});
