import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, OnDestroy } from '@angular/core';

const PANEL_TAG = 'tau-filter-assist-panel';
const PANEL_HOST_SELECTOR = 'nde-search-filters-side-nav .scroller-content';
const PANEL_DATA_ATTR = 'data-origin';
const PANEL_DATA_VALUE = 'custom-module';

@Injectable({
  providedIn: 'root',
})
export class FilterAssistPanelMountService implements OnDestroy {
  private observer?: MutationObserver;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    if (typeof window === 'undefined') {
      return;
    }

    // Delay initialization to allow Primo to load first
    setTimeout(() => {
      this.ensureMounted();
      if (typeof customElements !== 'undefined' && 'whenDefined' in customElements) {
        customElements.whenDefined(PANEL_TAG).then(() => this.ensureMounted());
      }
      this.observer = new MutationObserver(() => this.ensureMounted());
      this.observer.observe(this.document.body, {
        childList: true,
        subtree: true,
      });
    }, 2000); // Wait 2 seconds for Primo to initialize
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private ensureMounted(): void {
    const host = this.document.querySelector<HTMLElement>(PANEL_HOST_SELECTOR);
    if (!host) {
      return;
    }

    const existingInstance = host.querySelector<HTMLElement>(
      `${PANEL_TAG}[${PANEL_DATA_ATTR}="${PANEL_DATA_VALUE}"]`
    );

    if (existingInstance) {
      return;
    }

    if (typeof customElements === 'undefined') {
      return;
    }

    if (!customElements.get(PANEL_TAG)) {
      return;
    }

    const element = this.document.createElement(PANEL_TAG);
    element.setAttribute(PANEL_DATA_ATTR, PANEL_DATA_VALUE);
    host.insertBefore(element, host.firstElementChild ?? null);
  }
}
