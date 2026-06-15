# Debug logging — gated `dlog()` / `dwarn()`

**Why:** the TAU custom module loads as web components into Primo NDE in **every user's
browser**. Plain `console.log` in a shipped component therefore prints to the production
console — including, in some components, the ILL/resource-sharing **host component, DOM
nodes, and patron form data**. Security audit issue #10 flagged this. The fix is a logger
that is **off by default** and only emits when a developer explicitly turns it on.

## The rule

- Shipped code (`src/app/**`) must use **`dlog(...)`** / **`dwarn(...)`** from
  [`src/app/services/debug.util.ts`](../../src/app/services/debug.util.ts) for diagnostic logging —
  **not** `console.log` / `console.warn` / `console.info`.
- `console.error` is fine for **genuine, always-visible** error reporting (e.g. a `catch` block
  that failed to build a URL). Those should surface in production.
- **Never** log raw host components, DOM nodes, or patron/request-form objects — not even via
  `dlog`. Log a safe scalar instead (a boolean, a count, an id you control).

## How to turn it on (no rebuild, works on live production)

Open the browser console on any NDE page and run:

```js
localStorage.setItem('tauDebug', '1');   // then reload the page — TAU debug logs appear
```

Turn it back off:

```js
localStorage.removeItem('tauDebug');
```

The `localStorage` flag **persists across reloads**, so it also captures early
`ngDoBootstrap` / component-init logs. Accepted truthy values: `1`, `true`, `on`, `yes`.

**One-session alternative** (not persisted; cleared on reload):

```js
window.__TAU_DEBUG__ = true;
```

## How to use it in code

```ts
import { dlog, dwarn } from '../../services/debug.util'; // path relative to your file

dlog('IllPickupLibrarySorter: Attempt', this.attempts);   // visible only when tauDebug is on
dwarn('FilterAssistPanel: container not found; using fallback');

// Genuine error — keep visible in production:
console.error('Error building URL', e);
```

## The dev proxy

`proxy/proxy.conf.mjs` runs at `logLevel: 'info'` (not `'debug'`). At `'debug'`,
http-proxy-middleware prints full request/response detail — including the live Primo
host's `Cookie` / `Authorization` headers — to your terminal, which AI coding agents
snapshot (see `CLAUDE.md` → *Strict secret-handling mode*). Raise it to `'debug'` only
temporarily while debugging path rewrites, then put it back.

## Related

- `CLAUDE.md` → *Debug logging (RULE)* and *Strict secret-handling mode*
- Issue #10 — Security audit: sensitive data leaks to terminal or files
