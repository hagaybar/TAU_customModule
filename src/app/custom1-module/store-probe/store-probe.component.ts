/**
 * TAU host NgRx Store probe components — THROWAWAY diagnostic (issue #19).
 *
 * Two thin standalone components, each mapped to a different NDE extension slot
 * (see customComponentMappings.ts) so the probe mounts on both page types:
 *   - StoreProbeLocationComponent → `nde-location-bottom`  (record Get-It page → `delivery.holding[]`)
 *   - StoreProbeFiltersComponent  → `nde-filters-group-after` (search results → `router`/`search`)
 *
 * The host store is a single global instance, so whichever slot mounts, the
 * probe reads the SAME store. Two slots only hedge slot-name/page-availability
 * risk (NDE slot names are partly empirical — see issue #4). Each renders
 * nothing; all logic lives in the shared core (store-probe.util.ts) and is
 * inert unless the TAU debug flag is on.
 *
 * REMOVE with its mapping entries after issue #19 concludes.
 */
import { Component, Directive, OnDestroy, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { runStoreProbe } from './store-probe.util';

/** Selectorless base: Angular requires classes that use DI/lifecycle to be decorated. */
@Directive()
abstract class BaseStoreProbe implements OnInit, OnDestroy {
  /** Optional so a missing provider yields null (definitive result) instead of a crash at mount. */
  protected readonly store = inject(Store, { optional: true }) as Store<Record<string, unknown>> | null;
  /** The NDE slot this instance was mounted into — for log attribution. */
  protected abstract readonly slotLabel: string;

  private teardown: (() => void) | null = null;

  ngOnInit(): void {
    this.teardown = runStoreProbe(this.store, this.slotLabel);
  }

  ngOnDestroy(): void {
    this.teardown?.();
    this.teardown = null;
  }
}

@Component({
  selector: 'tau-store-probe-location',
  standalone: true,
  template: '',
})
export class StoreProbeLocationComponent extends BaseStoreProbe {
  protected readonly slotLabel = 'nde-location-bottom';
}

@Component({
  selector: 'tau-store-probe-filters',
  standalone: true,
  template: '',
})
export class StoreProbeFiltersComponent extends BaseStoreProbe {
  protected readonly slotLabel = 'nde-filters-group-after';
}
