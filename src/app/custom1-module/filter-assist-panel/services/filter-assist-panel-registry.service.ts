import { Injectable } from '@angular/core';
import { FilterAssistPanelComponent } from '../filter-assist-panel.component';
import { dlog } from '../../../services/debug.util';

/**
 * Registry service to ensure only one FilterAssistPanel instance renders
 * at a time, even when components are destroyed and recreated during
 * Angular's lifecycle (e.g., when filters change).
 */
@Injectable({
  providedIn: 'root'
})
export class FilterAssistPanelRegistryService {
  /**
   * Reference to the currently active (rendering) component instance
   */
  private activeInstance: FilterAssistPanelComponent | null = null;

  /**
   * Register a component instance as the active renderer
   * @param component The component instance attempting to register
   * @returns true if successfully registered (should render), false otherwise
   */
  register(component: FilterAssistPanelComponent): boolean {
    if (!this.activeInstance) {
      this.activeInstance = component;
      dlog('FilterAssistPanel registered as active instance');
      return true;
    }
    dlog('FilterAssistPanel registration denied (instance already active)');
    return false;
  }

  /**
   * Unregister a component instance when it's destroyed
   * Allows a new instance to register during next recreation cycle
   * @param component The component instance being destroyed
   */
  unregister(component: FilterAssistPanelComponent): void {
    if (this.activeInstance === component) {
      this.activeInstance = null;
      dlog('FilterAssistPanel unregistered (instance destroyed)');
    }
  }
}
