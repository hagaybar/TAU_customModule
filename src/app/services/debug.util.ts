/**
 * TAU custom-module debug logging.
 *
 * OFF by default so the production console stays clean and never receives raw
 * host components, DOM nodes, or patron form data. Enable at RUNTIME in the
 * browser console — no rebuild or redeploy needed (works on live production):
 *
 *   localStorage.setItem('tauDebug', '1');   // then reload — TAU debug logs appear
 *   localStorage.removeItem('tauDebug');       // turn it back off
 *
 * One-session alternative (not persisted across reloads):
 *
 *   window.__TAU_DEBUG__ = true;
 *
 * Rule + rationale: docs/development/debug-logging.md and CLAUDE.md.
 * Use dlog()/dwarn() for all diagnostic logging in shipped components instead of
 * console.log/console.warn. Genuine, always-visible error reporting may still use
 * console.error directly.
 */

const TAU_DEBUG_KEY = 'tauDebug';
const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

/** True when the TAU debug flag is set (localStorage 'tauDebug' or window.__TAU_DEBUG__). */
export function isTauDebugEnabled(): boolean {
  try {
    const w = window as unknown as { __TAU_DEBUG__?: boolean };
    if (w && w.__TAU_DEBUG__ === true) {
      return true;
    }
    const v = localStorage.getItem(TAU_DEBUG_KEY);
    return v !== null && TRUTHY.has(v.toLowerCase());
  } catch {
    // localStorage can throw in restricted/sandboxed contexts — fail closed (silent).
    return false;
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
