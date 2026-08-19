# Debug-logging activation — design

**Status:** proposed (2026-08-09) — awaiting review
**Owner:** Hagay Bar
**Scope:** `src/app/services/debug.util.ts`, the bootstrap banner in `src/app/app.module.ts`, and `scripts/check-debug-logging.mjs`
**Depends on:** PR #39 (gates the 28 raw console calls and introduces the guard script)

---

## 1. Context

`dlog()` / `dwarn()` are off unless `localStorage.tauDebug` is set. That default is correct — the custom module runs in every patron's browser — and the runtime flag is deliberately not a build flag, so logging can be switched on against live production with no rebuild and no package upload.

Two problems with it in practice.

**Silence is ambiguous.** An empty console does not distinguish "logging is off", "logging was never added to this component", and "the module didn't load". There is no way to tell which without reading the source or remembering a convention. The person hitting this is usually the person who wrote the convention, six weeks later.

**Enabling takes an action nobody remembers to take.** In the test view, where verbose output is always wanted, it has to be re-enabled per browser and after any storage clear.

A third gap surfaced while discussing this: the flag is per-browser, so logs cannot be handed to anyone else. Asking a colleague to open devtools and type a `localStorage` call is a poor instruction to give over email.

### The rejected framing

The first instinct was to bind logging to the view: always on in `NDE_TEST`, always off in `NDE`. That fixes the second problem and not the first — if production is silent by design, an empty production console is exactly as ambiguous as it is today. It also raises a fair objection: if the environment you can observe behaves differently from the one you care about, what does observing it prove?

That objection is real but narrow, and it points at the fix rather than away from it. `NDE` and `NDE_TEST` are built from the same repository with different `VIEW_ID` values, so the code is identical; what differs is Primo's data and back-office configuration. A bug in our code reproduces in test. A bug arising from production data does not — and those are precisely the cases needing logs from a live production session. So the conclusion is not "don't bind to the view" but **"bind the default to the view, and never lose the manual override."**

## 2. Goals

- An empty console must be self-explaining: it states whether logging is off and how to turn it on.
- The test view produces logs with no action taken.
- Production logging remains switchable at runtime, per session, with no rebuild or redeploy. **This property is non-negotiable — it is the reason the current design uses `localStorage` rather than a compile-time constant.**
- Logging can be enabled by someone who is not comfortable in devtools.
- An explicit choice always beats the environment default, in both directions, in every environment.
- Unrecognized views fail closed (silent).

## 3. Non-goals

- No remote kill-switch or server-fetched logging config. Nothing that adds a network dependency to the logger.
- No log shipping, aggregation, or telemetry. Output stays in the user's own console.
- No change to what is logged. The rule that raw host components, DOM nodes, and patron form data are never logged — not even via `dlog` — is unaffected.
- No change to `console.error`, which stays ungated for genuine errors.

## 4. Design

Three components. The first is the one that fixes the problem that actually bites; the other two are convenience.

### 4.1 The boot banner (always printed)

At bootstrap the module prints exactly one line, unconditionally, in every environment:

```
[TAU] custom module · 972TAU_INST-NDE · debug logging OFF
      enable: localStorage.setItem('tauDebug','1') then reload — or add ?tauDebug=1 to the URL
```

When logging is on it states that instead, says why (explicit choice vs. view default), and gives the off switch.

This is a deliberate exception to the no-`console.log` rule, and it is narrow: a static string plus one build-time constant. No host objects, no DOM nodes, no patron data, no runtime values of any kind. Naming the view in the line is what makes a mis-deployed package visible immediately.

**It lives in `debug.util.ts`** as an exported `logBootBanner()`, called once from `app.module.ts`. That placement is not incidental — `debug.util.ts` is already the guard script's only exemption, so the banner needs no new carve-out and no per-line suppression comment. There is exactly one ungated `console.log` in the codebase and it is in the file whose job is logging.

### 4.2 Environment-derived default

`src/app/state/asset-base.generated.ts` already carries the deployed view, written by `prebuild.js` from `build-settings.env`:

```ts
export const assetBaseUrl = '/nde/custom/972TAU_INST-NDE';
```

The view is the segment after the last `-`. The default comes from an explicit allow-list of verbose views:

```ts
const VERBOSE_BY_DEFAULT = ['NDE_TEST'];
```

**Allow-list, not a `NDE`-is-production check.** A future view added to the back office defaults to silent rather than inheriting verbosity by accident. Fail closed: the cost of a missing log line is an annoyance, the cost of an unexpected verbose production package is a rule violation.

This is evaluated at runtime from a build-time constant, so it costs one string comparison and stays overridable.

### 4.3 URL parameter (added after design approval — flagged for veto)

`?tauDebug=1` writes the flag into `localStorage` on first sight, then behaves exactly as if it had been set by hand; `?tauDebug=0` writes the off value. Persisting rather than reading per-navigation matters because Primo is a single-page app and an unrecognized query parameter will not survive in-app navigation.

The point is a link you can send: *"open this and tell me what the console says."* It grants no capability that did not already exist — anyone able to open a console could already set the flag — and the no-patron-data rule bounds what any of it can reveal.

### 4.4 Precedence

Ingest first, then evaluate.

**Ingest (once, at bootstrap):** if a `tauDebug` query parameter is present, write its value to `localStorage`.

**Evaluate (on every `dlog`/`dwarn` call):**

1. `window.__TAU_DEBUG__` — if it is exactly `true` or `false`, it wins. Session-only, not persisted.
2. `localStorage.tauDebug` — if the key is **present**, it wins, in both directions. A value in `{'1','true','on','yes'}` is on; any other value is off.
3. Otherwise, the view default from §4.2.

Step 2 keys on *presence*, not truthiness. That is what makes `setItem('tauDebug','0')` silence a test view that would otherwise default to verbose, and it is the difference between an override and a mere shortcut.

`localStorage` access stays inside the existing `try/catch` and fails closed to the view default when storage is unavailable.

## 5. Error handling

The logger must never be able to break the page. Every new code path — parsing the view out of `assetBaseUrl`, reading the query string, writing to `localStorage`, printing the banner — is wrapped so that any throw results in logging being **off** and the module continuing to boot. A malformed or unexpected `assetBaseUrl` yields no view match, which the allow-list already treats as silent.

## 6. Testing

`debug.util.ts` currently has no spec. The precedence logic is the kind of thing that looks obvious and has four interacting inputs, so it gets one.

Refactor the decision into a pure function taking its inputs explicitly — `window` override, raw `localStorage` value or `null`, and view string — so it is testable without touching globals. `isTauDebugEnabled()` becomes the thin wrapper that reads the real sources and calls it.

Cases to cover:

- View default on for `NDE_TEST`, off for `NDE`, off for an unrecognized view, off for a malformed `assetBaseUrl`.
- Explicit `localStorage` on and off each beating the view default, both directions, in both views.
- `window.__TAU_DEBUG__` beating an opposing `localStorage` value, both directions.
- Absent `localStorage` key falling through to the view default (distinct from a key present with a falsy value).
- `localStorage` throwing → falls back to the view default rather than propagating.
- Query-parameter ingest writing the expected value, and being a no-op when the parameter is absent.

Banner content is asserted for both states, including that it names the view.

Existing verification stays: `npm run build`, the full unit suite, and `npm run check:debug-logging` reporting clean.

## 7. Risks

**A package built for one view and uploaded to another.** Building with `VIEW_ID=NDE_TEST` and uploading to `NDE` produces a verbose production package. This risk does not exist today. It is mitigated but not eliminated by the banner naming the view on every page load, and bounded by the standing rule that patron data is never logged even when logging is on.

**One always-on line in production.** Accepted deliberately. One line per page load, no runtime values.

**The URL parameter is publicly usable.** No new capability, as above. If this is unwelcome it can be dropped without affecting §4.1 or §4.2 — it is the only independently removable component.

## 8. Rollout

Lands after PR #39. Documentation updates to `docs/development/debug-logging.md` and the *Debug logging (RULE)* section of `CLAUDE.md` ship in the same change, since both currently describe `localStorage` as the only mechanism.

## 9. Open question for review

The URL parameter (§4.3) was added after verbal approval of the banner and the view-linked default. Confirm or drop it.
