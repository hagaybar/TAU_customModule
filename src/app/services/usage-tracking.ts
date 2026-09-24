import { dlog, deployedPackage, deployedView } from './debug.util';
import { mixpanelProjectToken } from '../state/tracking.generated';

/**
 * Anonymous usage counting for TAU add-ons, sent to TAU's own Mixpanel project.
 *
 * Deliberately not the mixpanel-browser SDK: one POST per event is all we need, and the SDK
 * brings autocapture, cookies/localStorage identity and ~50 KB we would then have to switch
 * off one by one. Nothing here touches Primo's own analytics.
 *
 * Privacy: nothing is stored in the patron's browser. Every event gets a fresh random
 * distinct_id, and `ip=0` tells Mixpanel not to derive location from the IP. We count opens,
 * not people. Never put patron or request-form data in event properties.
 */

/**
 * Mixpanel PROJECT token (not the API secret — that must never appear anywhere here).
 * Comes from $TAU_MIXPANEL_TOKEN at build time via prebuild.js → tracking.generated.ts, so it
 * is never committed. It does ship in the bundle; project tokens are public by design.
 * Empty = tracking off.
 */
export const MIXPANEL_PROJECT_TOKEN: string = mixpanelProjectToken;

/** Views that send events. Add 'NDE' when the NDE_TEST trial is verified. */
export const TRACKING_VIEWS: readonly string[] = ['NDE_TEST'];

/** EU data residency — TAU's project lives in the EU region. */
export const MIXPANEL_TRACK_URL = 'https://api-eu.mixpanel.com/track?ip=0&verbose=1';

export type TrackProperties = Record<string, string | number | boolean | null | undefined>;

export interface TrackingConfig {
  token: string;
  views: readonly string[];
  view: string;
}

const defaultConfig = (): TrackingConfig => ({
  token: MIXPANEL_PROJECT_TOKEN,
  views: TRACKING_VIEWS,
  view: deployedView(),
});

/** Whether events are sent from this build. Pure, for testing. */
export function trackingEnabled(config: TrackingConfig): boolean {
  return !!config.token && config.views.includes(config.view);
}

/** The Primo view id this build serves, e.g. '972TAU_INST:NDE_TEST'. */
export function viewId(pkg: string = deployedPackage()): string {
  const dash = pkg.lastIndexOf('-');
  return dash === -1 ? pkg : `${pkg.slice(0, dash)}:${pkg.slice(dash + 1)}`;
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

/** The Mixpanel /track payload for one event. Pure apart from ids and time; exported for tests. */
export function buildEvent(
  event: string,
  properties: TrackProperties,
  token: string
): { event: string; properties: TrackProperties & { token: string; distinct_id: string; $insert_id: string; time: number } }[] {
  return [
    {
      event,
      properties: {
        ...properties,
        token,
        distinct_id: randomId(),
        $insert_id: randomId(),
        time: Date.now(),
      },
    },
  ];
}

/**
 * Send one event. Fire-and-forget: never throws, never blocks the caller, and does nothing
 * unless this view is enabled and a token is set.
 */
export function trackEvent(
  event: string,
  properties: TrackProperties,
  config: TrackingConfig = defaultConfig()
): void {
  try {
    if (!trackingEnabled(config)) {
      dlog(`[Tracking] off for view "${config.view}" (token ${config.token ? 'set' : 'empty'}); not sent: ${event}`);
      return;
    }
    // Form-encoded body keeps this a CORS "simple request" — no preflight.
    const body = new URLSearchParams({ data: JSON.stringify(buildEvent(event, properties, config.token)) });
    fetch(MIXPANEL_TRACK_URL, { method: 'POST', body, keepalive: true })
      .then(res => res.json())
      .then(result => dlog(`[Tracking] ${event}:`, result))
      .catch(() => dlog(`[Tracking] ${event}: request failed`));
  } catch {
    // Tracking must never break the feature it measures.
  }
}
