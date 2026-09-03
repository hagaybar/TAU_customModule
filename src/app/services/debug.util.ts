/**
 * TAU custom-module debug logging.
 *
 * OFF by default in production so the console stays clean and never receives raw
 * host components, DOM nodes, or patron form data. Three ways to change that, in
 * descending precedence — an explicit choice always beats the environment default,
 * in both directions:
 *
 *   window.__TAU_DEBUG__ = true;             // this session only, not persisted
 *   localStorage.setItem('tauDebug', '1');   // then reload — persists, both directions
 *   ?tauDebug=1                              // in the URL — persists itself, then as above
 *
 * `localStorage.setItem('tauDebug','0')` is a real "off", not just an absent key:
 * it silences a view that would otherwise default to verbose. Remove the key with
 * `localStorage.removeItem('tauDebug')` to fall back to the view default.
 *
 * The flag is deliberately a RUNTIME switch rather than a build flag, so logging can
 * be turned on against live production with no rebuild and no package upload.
 *
 * Views in VERBOSE_BY_DEFAULT log without anyone doing anything; every other view,
 * including any view added in future, is silent unless asked. Fail closed.
 *
 * Rule + rationale: docs/development/debug-logging.md and CLAUDE.md.
 * Design: docs/superpowers/specs/2026-08-09-debug-logging-activation-design.md.
 * Use dlog()/dwarn() for all diagnostic logging in shipped components instead of
 * console.log/console.warn. Genuine, always-visible error reporting may still use
 * console.error directly.
 */

import { assetBaseUrl } from '../state/asset-base.generated';

const TAU_DEBUG_KEY = 'tauDebug';
const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

/**
 * Views that log without being asked. An allow-list, not an "is it production?" test:
 * a view added to the Back Office later defaults to silent rather than inheriting
 * verbosity by accident. A missing log line is an annoyance; an unexpectedly verbose
 * production package is a rule violation.
 */
export const VERBOSE_BY_DEFAULT: readonly string[] = ['NDE_TEST'];

/** Why logging is on or off — reported in the boot banner so the state is never a mystery. */
export type DebugReason = 'session override' | 'explicit choice' | 'view default';

export interface DebugState {
  enabled: boolean;
  reason: DebugReason;
}

/**
 * The package this build was made for, e.g. '972TAU_INST-NDE' — the last path segment
 * of the generated asset base. Empty string if it cannot be determined.
 */
export function deployedPackage(base: string = assetBaseUrl): string {
  try {
    return base.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return '';
  }
}

/**
 * The view this build was made for, e.g. 'NDE' or 'NDE_TEST' — the segment after the
 * last '-' of the package id. Empty string if absent or malformed, which the
 * VERBOSE_BY_DEFAULT allow-list then treats as silent.
 */
export function deployedView(base: string = assetBaseUrl): string {
  const pkg = deployedPackage(base);
  const dash = pkg.lastIndexOf('-');
  return dash === -1 ? '' : pkg.slice(dash + 1);
}

/**
 * The precedence rule, as a pure function of its three inputs so it can be tested
 * without touching globals:
 *
 *   1. window.__TAU_DEBUG__, when it is exactly true or false.
 *   2. the stored value, when the key is PRESENT — in both directions.
 *   3. otherwise the view default.
 *
 * Step 2 keys on presence rather than truthiness. That is what makes an explicit
 * stored '0' an override rather than a mere shortcut.
 */
export function resolveDebugState(
  windowOverride: boolean | undefined,
  storedValue: string | null,
  view: string
): DebugState {
  if (windowOverride === true || windowOverride === false) {
    return { enabled: windowOverride, reason: 'session override' };
  }
  if (storedValue !== null) {
    return { enabled: TRUTHY.has(storedValue.trim().toLowerCase()), reason: 'explicit choice' };
  }
  return { enabled: VERBOSE_BY_DEFAULT.includes(view), reason: 'view default' };
}

/** window.__TAU_DEBUG__ when it is exactly true or false; undefined otherwise. */
function readWindowOverride(): boolean | undefined {
  try {
    const w = window as unknown as { __TAU_DEBUG__?: unknown };
    if (w?.__TAU_DEBUG__ === true) return true;
    if (w?.__TAU_DEBUG__ === false) return false;
    return undefined;
  } catch {
    return undefined;
  }
}

/** The stored flag, or null when absent — or when storage is unavailable, which falls
 * through to the view default rather than propagating the throw. */
function readStoredValue(): string | null {
  try {
    return localStorage.getItem(TAU_DEBUG_KEY);
  } catch {
    return null;
  }
}

/**
 * Copy a `tauDebug` query parameter into localStorage, so the rest of the app sees it
 * exactly as if it had been set by hand. Call once at bootstrap, before anything reads
 * the flag.
 *
 * Persisting rather than reading per-navigation is deliberate: Primo is a single-page
 * app, and an unrecognized query parameter does not survive in-app navigation.
 *
 * Returns true when a parameter was present and stored.
 */
export function ingestDebugQueryParam(search?: string): boolean {
  try {
    const raw = new URLSearchParams(search ?? window.location.search).get(TAU_DEBUG_KEY);
    if (raw === null) return false;
    localStorage.setItem(TAU_DEBUG_KEY, TRUTHY.has(raw.trim().toLowerCase()) ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

/** True when TAU debug logging is currently on. */
export function isTauDebugEnabled(): boolean {
  return resolveDebugState(readWindowOverride(), readStoredValue(), deployedView()).enabled;
}

/**
 * The boot banner text: what package this is, whether logging is on, why, and the switch
 * for the other direction. A static string plus one build-time constant — no runtime
 * values, no host objects, no patron data.
 */
export function bootBannerText(state: DebugState, pkg: string): string {
  const where = pkg || 'unknown package';
  if (state.enabled) {
    return (
      `[TAU] custom module · ${where} · debug logging ON (${state.reason})\n` +
      `      disable: localStorage.setItem('tauDebug','0') then reload`
    );
  }
  return (
    `[TAU] custom module · ${where} · debug logging OFF (${state.reason})\n` +
    `      enable: localStorage.setItem('tauDebug','1') then reload — or add ?tauDebug=1 to the URL`
  );
}

/**
 * Print the boot banner. Unconditional and always visible — the one ungated console.log
 * in the codebase, and it lives in the file whose job is logging.
 *
 * This is what makes an empty console self-explaining: without it, silence cannot
 * distinguish "logging is off" from "this component never logged" from "the module never
 * loaded". Naming the package also makes a mis-deployed build visible on the first page
 * load rather than after an afternoon of confusion.
 */
export function logBootBanner(): void {
  try {
    const state = resolveDebugState(readWindowOverride(), readStoredValue(), deployedView());
    console.log(bootBannerText(state, deployedPackage()));
  } catch {
    // The logger must never be able to break the page.
  }
}

/** console.log gated behind the TAU debug flag (silent in production by default). */
export function dlog(...args: unknown[]): void {
  if (isTauDebugEnabled()) {
    console.log(...args);
  }
}

/** console.warn gated behind the TAU debug flag (silent in production by default). */
export function dwarn(...args: unknown[]): void {
  if (isTauDebugEnabled()) {
    console.warn(...args);
  }
}
