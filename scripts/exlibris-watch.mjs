#!/usr/bin/env node
/**
 * Weekly Ex Libris watch for the Angular 20 upgrade (issue #75).
 *
 * Reads two sources, compares them with the state recorded in the last report on
 * the issue, and posts a short report comment every run (changed or not):
 *   1. Ex Libris "Release Changes Requiring Customization Review" page (article text only)
 *   2. Upstream ExLibrisGroup/customModule: main's head and every branch named *angular*
 *
 * State lives in the report comment itself (a hidden marker), so nothing is committed.
 * Run by .github/workflows/exlibris-watch.yml. Env:
 *   GITHUB_TOKEN   token with issues:write on the target repo
 *   WATCH_REPO     owner/name of the repo holding the issue (default hagaybar/TAU_customModule)
 *   WATCH_ISSUE    issue number (default 75)
 *   WATCH_DRY_RUN  "1" = print the report, do not post
 */
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PAGE_URL =
  'https://knowledge.exlibrisgroup.com/Primo/Release_Notes/002Primo_VE/2026/Release_Changes_Requiring_Customization_Review';
export const UPSTREAM = 'ExLibrisGroup/customModule';
export const MARKER = 'exlibris-watch:v1';
const START = 'Changes That May Impact Customizations';
const END = 'View article in the Exlibris Knowledge Center';
const MAX_DIFF_LINES = 25;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Article text of the page, one trimmed line per block, without site chrome. */
export function extractArticle(html) {
  let s = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<[^>]+>/g, '\n');
  s = s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // The table of contents repeats the headings; the article starts at the last
  // occurrence of the first heading before the end marker.
  const end = lines.lastIndexOf(END);
  if (end < 0) throw new Error(`page layout changed: end marker "${END}" not found`);
  const start = lines.lastIndexOf(START, end);
  if (start < 0) throw new Error(`page layout changed: start marker "${START}" not found`);
  const article = lines.slice(start, end);
  if (article.length < 5) throw new Error('page layout changed: article text is implausibly short');
  return article;
}

export function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** Lines added and removed between two line lists (order-insensitive, good enough for prose). */
export function lineDiff(before, after) {
  const b = new Set(before);
  const a = new Set(after);
  return { added: after.filter((l) => !b.has(l)), removed: before.filter((l) => !a.has(l)) };
}

export function parseState(body) {
  const m = body?.match(new RegExp(`<!--\\s*${MARKER}\\s+([A-Za-z0-9+/=]+)\\s*-->`));
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function encodeState(state) {
  return `<!-- ${MARKER} ${Buffer.from(JSON.stringify(state)).toString('base64')} -->`;
}

const fmtDate = (d) =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCFullYear()).slice(2)}`;

/** Build the report comment. `prev` is null on the first run. */
export function buildReport({ now, prev, page, upstream, runUrl }) {
  const out = [];
  const changes = [];

  if (!prev) {
    changes.push('first run: baseline recorded');
  } else {
    if (prev.pageHash !== page.hash) changes.push('Ex Libris page');
    if (prev.upstreamMain !== upstream.main) changes.push('upstream `main`');
    const pb = prev.branches || {};
    const nb = upstream.branches;
    const branchChanged =
      Object.keys(nb).some((k) => pb[k] !== nb[k]) || Object.keys(pb).some((k) => !(k in nb));
    if (branchChanged) changes.push('upstream Angular branches');
  }
  const changed = prev && changes.length > 0;

  out.push(
    `## Weekly Ex Libris check ${fmtDate(now)}: ${
      !prev ? 'baseline recorded' : changed ? `**CHANGED** (${changes.join(', ')})` : 'no change'
    }`,
  );
  out.push('');

  // Page
  if (prev && prev.pageHash !== page.hash) {
    const d = lineDiff(prev.pageLines || [], page.lines);
    out.push(`**[Ex Libris page](${PAGE_URL})** changed. Read it, then update this issue.`);
    const show = [...d.added.map((l) => `+ ${l}`), ...d.removed.map((l) => `- ${l}`)];
    if (show.length) {
      out.push('```diff', ...show.slice(0, MAX_DIFF_LINES), '```');
      if (show.length > MAX_DIFF_LINES) out.push(`…and ${show.length - MAX_DIFF_LINES} more lines.`);
    }
  } else {
    out.push(`- [Ex Libris page](${PAGE_URL}): ${prev ? 'unchanged' : 'recorded'} (\`${page.hash}\`).`);
  }
  out.push(
    `- Mentions of guidance or a test environment for Angular 20: ${
      page.guidanceLinks.length ? page.guidanceLinks.map((l) => `<${l}>`).join(', ') : 'none linked yet'
    }.`,
  );

  // Upstream
  const pm = prev?.upstreamMain;
  out.push(
    `- Upstream \`main\`: \`${upstream.main.slice(0, 7)}\`${pm && pm !== upstream.main ? ` (was \`${pm.slice(0, 7)}\`) — run "let's check upstream"` : ''}.`,
  );
  const names = Object.keys(upstream.branches).sort();
  const pb = prev?.branches || {};
  const lines = names.map((n) => {
    const tag = !prev ? '' : !(n in pb) ? ' **new**' : pb[n] !== upstream.branches[n] ? ' **updated**' : '';
    return `\`${n}\` \`${upstream.branches[n].slice(0, 7)}\`${tag}`;
  });
  for (const gone of Object.keys(pb).filter((n) => !(n in upstream.branches))) lines.push(`\`${gone}\` **deleted**`);
  out.push(`- Upstream Angular branches: ${lines.length ? lines.join(' · ') : 'none'}.`);

  out.push('');
  out.push(`<sub>Automated by \`.github/workflows/exlibris-watch.yml\`${runUrl ? ` · [run](${runUrl})` : ''}.</sub>`);
  out.push(
    encodeState({
      pageHash: page.hash,
      pageLines: page.lines,
      upstreamMain: upstream.main,
      branches: upstream.branches,
      checkedAt: now.toISOString(),
    }),
  );
  return { body: out.join('\n'), changed: !!changed };
}

/** Links in the article that look like Angular 20 guidance or a test environment. */
export function guidanceLinks(html) {
  const found = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (m[1].startsWith('#')) continue; // in-page table-of-contents anchor
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (/angular|test(ing)? environment|preview environment/i.test(`${m[1]} ${text}`)) found.add(m[1]);
  }
  return [...found];
}

async function gh(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tau-exlibris-watch',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${res.status}`);
  return res.json();
}

async function ghAll(path, opts) {
  const all = [];
  for (let page = 1; page < 50; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await gh(`${path}${sep}per_page=100&page=${page}`, opts);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.WATCH_REPO || 'hagaybar/TAU_customModule';
  const issue = process.env.WATCH_ISSUE || '75';
  const dry = process.env.WATCH_DRY_RUN === '1';
  const runUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '';
  if (!token && !dry) throw new Error('GITHUB_TOKEN is required unless WATCH_DRY_RUN=1');

  const res = await fetch(PAGE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (tau-exlibris-watch)' } });
  if (!res.ok) throw new Error(`Ex Libris page: HTTP ${res.status}`);
  const html = await res.text();
  const lines = extractArticle(html);
  const page = { lines, hash: hash(lines.join('\n')), guidanceLinks: guidanceLinks(html) };

  const main = (await gh(`repos/${UPSTREAM}/branches/main`, { token })).commit.sha;
  const branches = Object.fromEntries(
    (await ghAll(`repos/${UPSTREAM}/branches`, { token }))
      .filter((b) => /angular/i.test(b.name))
      .map((b) => [b.name, b.commit.sha]),
  );

  const comments = await ghAll(`repos/${repo}/issues/${issue}/comments`, { token });
  const prev = comments.map((c) => parseState(c.body)).filter(Boolean).pop() || null;

  const { body, changed } = buildReport({ now: new Date(), prev, page, upstream: { main, branches }, runUrl });
  console.log(body.replace(/<!--[\s\S]*?-->/, '<!-- state -->'));
  if (dry) {
    console.log('\n(dry run: not posted)');
  } else {
    const c = await gh(`repos/${repo}/issues/${issue}/comments`, { token, method: 'POST', body: { body } });
    console.log(`\nposted: ${c.html_url}`);
  }
  if (changed) console.log('::notice::Ex Libris watch found a change; see the report on the issue.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`exlibris-watch failed: ${err.message}`);
    process.exit(1);
  });
}
