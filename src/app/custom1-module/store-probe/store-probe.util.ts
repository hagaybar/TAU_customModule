/**
 * TAU host NgRx Store probe — THROWAWAY diagnostic (issue #19).
 *
 * Purpose: answer one empirical question that cannot be settled by reading the
 * repo — when a TAU custom component asks Angular's injector for the host's
 * `@ngrx/store` `Store`, does it get Primo's **populated** root state, a
 * separate **empty** store, or **nothing at all**?
 *
 *   webpack.config.js:84 shares `@ngrx/store` as a singleton, which proves the
 *   library/token is shared — but NOT that our injector resolves `Store` to the
 *   host's populated instance. Only a live probe settles it. See issue #19.
 *
 * SAFETY (CLAUDE.md secret/PII rule): the store contains user/session/account
 * data. Automatic logging here emits **structure only** (slice names and
 * field-name shapes — never values). Raw values are reachable only via the
 * user-invoked `window.__tauStoreProbe` console helpers, which *return* live
 * objects for local devtools inspection and are NOT logged. Do not paste the
 * `user`/`account`/`session` slices back into chat.
 *
 * Fully inert unless the TAU debug flag is on (see debug.util.ts): it does not
 * subscribe, log, or install the global helper otherwise.
 *
 * REMOVE after the evaluation in issue #19 concludes (probe + its two mapping
 * entries in customComponentMappings.ts).
 */
import { Store } from '@ngrx/store';
import { dlog, dwarn, isTauDebugEnabled } from '../../services/debug.util';

type AnyState = Record<string, unknown>;

/** Slices we specifically care about for the DOM/URL → store migration (issue #19). */
const SLICES_OF_INTEREST = ['delivery', 'router', 'search'] as const;

/** Latest whole-state snapshot, captured by the subscription; read by the console helper. */
let latestState: AnyState | null = null;
/** Signature of the last-seen top-level key set, so we log only when the shape changes. */
let lastKeysSig = '';
/** Guard so the interactive global is installed exactly once. */
let helperInstalled = false;

/**
 * Return a compact STRUCTURE of a value — field names and types only, never
 * values — so it is safe to log and safe to share. Bounded in depth/breadth.
 */
function shapeOf(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value !== 'object') return typeof value;
  if (depth > 5) return '…';
  if (Array.isArray(value)) {
    return value.length ? [shapeOf(value[0], depth + 1), `…(len ${value.length})`] : [];
  }
  const keys = Object.keys(value as AnyState);
  const shown = keys.slice(0, 8);
  const out: AnyState = {};
  for (const k of shown) out[k] = shapeOf((value as AnyState)[k], depth + 1);
  if (keys.length > shown.length) out['…'] = `(${keys.length} keys total)`;
  return out;
}

interface TauStoreProbe {
  /** The injected host Store (an Observable of the whole state). */
  readonly store: Store<AnyState>;
  /** Latest whole-state snapshot (raw — may contain PII; local inspection only). */
  readonly state: AnyState | null;
  /** Top-level slice names currently in the store. */
  keys(): string[];
  /** Raw value of a named slice (local inspection only; may contain PII). */
  slice(name: string): unknown;
  /** PII-safe STRUCTURE (field names/types, no values) of a named slice — safe to share. */
  shape(name: string): unknown;
  /** Raw `delivery` slice (holdings) for local inspection. */
  delivery(): unknown;
  /** Raw `router` slice (queryParams) for local inspection. */
  router(): unknown;
  /** Raw `search` slice for local inspection. */
  search(): unknown;
  /** Logs the PII-safe structure of the whole state (field names only). */
  dumpShape(): unknown;
}

function installHelper(store: Store<AnyState>): void {
  if (helperInstalled) return;
  helperInstalled = true;
  const probe: TauStoreProbe = {
    store,
    get state() {
      return latestState;
    },
    keys() {
      return latestState ? Object.keys(latestState) : [];
    },
    slice(name: string) {
      return latestState ? latestState[name] : undefined;
    },
    shape(name: string) {
      return latestState ? shapeOf(latestState[name]) : '(no state yet)';
    },
    delivery() {
      return this.slice('delivery');
    },
    router() {
      return this.slice('router');
    },
    search() {
      return this.slice('search');
    },
    dumpShape() {
      const s = latestState ? shapeOf(latestState) : '(no state yet)';
      dlog('🔬 [store-probe] whole-state STRUCTURE (field names only, no values):', s);
      return s;
    },
  };
  (window as unknown as { __tauStoreProbe?: TauStoreProbe }).__tauStoreProbe = probe;
  dlog('🔬 [store-probe] interactive helper ready → window.__tauStoreProbe');
  dlog('     safe:   __tauStoreProbe.keys() | .shape("delivery") | .dumpShape()');
  dlog('     raw (local inspection, may contain PII — do not paste user/account/session): ' +
    '.delivery() | .router() | .search() | .slice(name) | .state');
}

/**
 * Activate the probe for one mounted component instance. No-op (fully inert)
 * unless the TAU debug flag is on. Returns a teardown to unsubscribe on destroy.
 */
export function runStoreProbe(store: Store<AnyState> | null, slotLabel: string): () => void {
  if (!isTauDebugEnabled()) {
    return () => undefined;
  }

  if (!store) {
    // Definitive negative result: our injector has no Store provider at all.
    dwarn(`🔬 [store-probe:${slotLabel}] mounted, but inject(Store) is NULL — the host NgRx ` +
      `store is NOT reachable via the custom module's injector on this build. ` +
      `(Path B — direct inject(Store) — is blocked as feared; see issue #19.)`);
    return () => undefined;
  }

  dlog(`🔬 [store-probe:${slotLabel}] mounted — inject(Store) returned a non-null Store. Watching state…`);
  installHelper(store);

  const sub = store.subscribe((state) => {
    latestState = (state ?? {}) as AnyState;
    const keys = Object.keys(latestState).sort();
    const sig = keys.join(',');
    if (sig === lastKeysSig) {
      return; // only log when the top-level shape changes — avoid console spam
    }
    lastKeysSig = sig;

    if (keys.length === 0) {
      dwarn(`🔬 [store-probe:${slotLabel}] state emitted but EMPTY ({}) — likely a separate/local ` +
        `Store instance, not the host's populated root state. (Path B likely not viable.)`);
      return;
    }

    dlog(`🔬 [store-probe:${slotLabel}] host state POPULATED — top-level slices (${keys.length}):`, keys);
    for (const name of SLICES_OF_INTEREST) {
      if (name in latestState) {
        // Structure only — safe. Values via __tauStoreProbe.<name>() on demand.
        dlog(`     ↳ "${name}" present ✅ — structure:`, shapeOf(latestState[name]));
      } else {
        dlog(`     ↳ "${name}" absent on this page (may populate on a different view).`);
      }
    }
  });

  return () => sub.unsubscribe();
}
