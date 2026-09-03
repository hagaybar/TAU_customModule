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

## The boot banner — read this before anything else

Every page load prints exactly one line, in **every** view, whether or not logging is on:

```
[TAU] custom module · 972TAU_INST-NDE · debug logging OFF (view default)
      enable: localStorage.setItem('tauDebug','1') then reload — or add ?tauDebug=1 to the URL
```

It is the answer to *"the console is empty — is that bad?"*. Without it, silence cannot
distinguish **logging is off**, **this component never logged anything**, and **the module
never loaded at all**. Now it can:

| What you see | What it means |
|---|---|
| No `[TAU]` line at all | The module did not load. Stop debugging your component. |
| `debug logging OFF` | The module is fine; you just have not turned logging on. |
| `debug logging ON` and still nothing | The module is fine, logging is on — the silence is real. |

The line also **names the package it was built for**, which makes a mis-deployed build
visible on the first page load: if a `NDE_TEST` package has been uploaded to `NDE`, the
banner says so immediately.

This is the one deliberate exception to the no-`console.log` rule, and it is a narrow one —
a static string plus one build-time constant. No runtime values, no host objects, no patron
data. It lives in `debug.util.ts`, which the guard already exempts, so it needs no carve-out.

## How to turn it on (no rebuild, works on live production)

**In the test view you do not have to.** `NDE_TEST` logs by default. Every other view is
silent unless asked — including any view added in future, which fails closed rather than
inheriting verbosity by accident.

Three switches, in **descending precedence**. An explicit choice always beats the view
default, in *both* directions:

**1. Send someone a link.** Add `?tauDebug=1` to any NDE URL. It writes the flag to
`localStorage` on arrival and behaves from then on exactly as if it had been typed by hand —
which matters because Primo is a single-page app and a stray query parameter would not
survive in-app navigation. Use `?tauDebug=0` to switch logging off the same way. This is the
one to use when the person who needs to read the console is not comfortable in devtools:
*"open this link and tell me what it says."*

**2. Type it in the console** on any NDE page:

```js
localStorage.setItem('tauDebug', '1');   // then reload the page — TAU debug logs appear
localStorage.setItem('tauDebug', '0');   // explicit OFF — silences even NDE_TEST
localStorage.removeItem('tauDebug');     // no opinion — fall back to the view default
```

Note the difference between `'0'` and `removeItem`. Storing `'0'` is a real override that
silences a view which would otherwise be verbose; removing the key just stops overriding.
The `localStorage` flag **persists across reloads**, so it also captures early
`ngDoBootstrap` / component-init logs. Accepted truthy values: `1`, `true`, `on`, `yes`
(case-insensitive); anything else stored is treated as off.

**3. One session only** (not persisted; cleared on reload), and it beats both of the above:

```js
window.__TAU_DEBUG__ = true;    // or false, to force silence for this session
```

The flag is deliberately a **runtime** switch rather than a build flag. That is what lets you
turn logging on against live production with no rebuild and no package upload — a property
worth protecting in any future change here.

## How to use it in code

```ts
import { dlog, dwarn } from '../../services/debug.util'; // path relative to your file

dlog('IllPickupLibrarySorter: Attempt', this.attempts);   // visible only when tauDebug is on
dwarn('FilterAssistPanel: container not found; using fallback');

// Genuine error — keep visible in production:
console.error('Error building URL', e);
```

## The guard — `npm run check:debug-logging`

`scripts/check-debug-logging.mjs` scans every non-spec `.ts` file under `src/app` and fails
(exit 1) on any `console.log` / `console.warn` / `console.info`, listing file and line.
`console.error` is allowed and is never reported; `src/app/services/debug.util.ts` is exempt
because it *is* the logger — which is also why the boot banner lives there rather than in
`app.module.ts`.

Run it before opening a PR that touches components. It exists because the rule was silently
broken once already: the CenLib Shelf Map feature merged on 2026-06-21, six days after the
audit in #10 established the rule, carrying 27 raw `console.log` calls that shipped to
production — including patrons' library names and call numbers. Nothing caught it for seven
weeks. A grep is cheaper than another audit.

## The dev proxy

`proxy/proxy.conf.mjs` runs at `logLevel: 'info'` (not `'debug'`). At `'debug'`,
http-proxy-middleware prints full request/response detail — including the live Primo
host's `Cookie` / `Authorization` headers — to your terminal, which AI coding agents
snapshot (see `CLAUDE.md` → *Strict secret-handling mode*). Raise it to `'debug'` only
temporarily while debugging path rewrites, then put it back.

## Adding a view that should log by default

`VERBOSE_BY_DEFAULT` in [`debug.util.ts`](../../src/app/services/debug.util.ts) is an explicit
allow-list — currently just `NDE_TEST`. The view is read at runtime from the build-time
`assetBaseUrl` (`/nde/custom/972TAU_INST-NDE_TEST` → `NDE_TEST`), so it costs one string
comparison and stays overridable.

It is an allow-list rather than an "is it production?" test on purpose: a new view fails
closed. The cost of a missing log line is an annoyance; the cost of an unexpectedly verbose
production package is a rule violation.

**The risk this creates:** building with `VIEW_ID=NDE_TEST` and uploading that package to
`NDE` produces a verbose production package. The banner naming the package on every page load
mitigates it but does not eliminate it, and the standing rule that patron data is never logged
— even when logging is on — bounds the damage.

## Related

- `CLAUDE.md` → *Debug logging (RULE)* and *Strict secret-handling mode*
- [Design spec](../superpowers/specs/2026-08-09-debug-logging-activation-design.md) — the
  reasoning behind the banner, the view default, and the URL parameter (issue #40)
- Issue #10 — Security audit: sensitive data leaks to terminal or files
