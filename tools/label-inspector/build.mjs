// Builds bookmarklet.txt (a javascript: URL) from label-inspector.js. Issue #54.
// Usage: node tools/label-inspector/build.mjs           (writes bookmarklet.txt)
//        node tools/label-inspector/build.mjs --check   (fails if bookmarklet.txt is stale)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SOURCE = join(here, 'label-inspector.js');
export const OUTPUT = join(here, 'bookmarklet.txt');

/** Drops whole-line // comments and indentation; keeps newlines so ASI behaves as in the source. */
export function buildBookmarklet(source) {
  const code = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .join('\n');
  return 'javascript:' + encodeURIComponent(code) + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const built = buildBookmarklet(readFileSync(SOURCE, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(OUTPUT, 'utf8') !== built) {
      console.error('bookmarklet.txt is stale: run node tools/label-inspector/build.mjs');
      process.exit(1);
    }
    console.log('bookmarklet.txt is up to date');
  } else {
    writeFileSync(OUTPUT, built);
    console.log(`wrote ${OUTPUT} (${built.length} chars)`);
  }
}
