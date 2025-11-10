# Bug Fix History

This document tracks significant bugs encountered during development and how they were resolved.

---

## Bug #2: Custom Element Double Registration (Fixed: 2025-11-09)

### Symptoms
- Custom element not displaying in NDE UI after switching to official selector mapping
- Console error: `NotSupportedError: Failed to execute 'define' on 'CustomElementRegistry': this constructor has already been used with this registry`
- Console shows: `lookup.service.ts:107 Loaded custom module CustomModule Set(1) {'nde-search-filters-side-nav'}`
- Element appears in mapping but never renders on page

### Root Cause
**Double registration of custom elements** - Both our `AppModule.ngDoBootstrap()` and NDE framework trying to register the same custom element.

#### What Was Wrong:

**Our Implementation** (`src/app/app.module.ts:36-43`):
```typescript
ngDoBootstrap(appRef: ApplicationRef) {
  for (const [key, value] of selectorComponentMap) {
    const customElement = createCustomElement(value, {injector: this.injector});
    this.webComponentSelectorMap.set(key, customElement);
    if (!customElements.get(key)) {
      customElements.define(key, customElement);  // ❌ WRONG - NDE does this
    }
  }
}
```

**Official ExLibris Pattern** (from GitHub repository):
```typescript
ngDoBootstrap(appRef: ApplicationRef) {
  for (const [key, value] of selectorComponentMap) {
    const customElement = createCustomElement(value, {injector: this.injector});
    this.webComponentSelectorMap.set(key, customElement);
    // ✅ NO customElements.define() call - framework handles it
  }
}
```

### How NDE Framework Works

1. NDE loads the custom module and reads `selectorComponentMap`
2. For entry `['nde-search-filters-side-nav-top', FilterAssistPanelComponent]`:
   - NDE strips the position suffix (`-top`) to get base selector: `nde-search-filters-side-nav`
   - NDE calls our `AppModule.getComponentRef('nde-search-filters-side-nav-top')` to retrieve the custom element constructor
   - NDE registers the element with its own naming scheme
   - NDE inserts the element at the position indicated by the suffix (`-top` = first child within component)
3. If we also call `customElements.define()`, it creates a registration collision

### The Fix

**Remove the `customElements.define()` call** from `AppModule.ngDoBootstrap()` to match the official ExLibris implementation:

```typescript
ngDoBootstrap(appRef: ApplicationRef) {
  for (const [key, value] of selectorComponentMap) {
    const customElement = createCustomElement(value, {injector: this.injector});
    this.webComponentSelectorMap.set(key, customElement);
    // NDE framework handles customElements.define() - we just create and store the constructor
  }
}
```

### Component Architecture (Correct Pattern)

**Component Selector** (`filter-assist-panel.component.ts`):
```typescript
@Component({
  selector: 'tau-filter-assist-panel',  // Unique custom selector
  standalone: true,
  // ...
})
export class FilterAssistPanelComponent {}
```

**Mapping Configuration** (`customComponentMappings.ts`):
```typescript
export const selectorComponentMap = new Map<string, any>([
  ['nde-search-filters-side-nav-top', FilterAssistPanelComponent],
  //  ↑ NDE location + position          ↑ Component class
]);
```

**Why These Are Different:**
- Component selector (`tau-filter-assist-panel`) is the custom element tag name created from our component
- Mapping key (`nde-search-filters-side-nav-top`) tells NDE WHERE and HOW to insert it
- Angular Elements best practice: never use component selector as custom element registration key to avoid dual instantiation

### Results

✅ **No registration conflicts** - NDE framework has full control
✅ **Custom element displays correctly** - Framework inserts at proper location
✅ **Follows official pattern** - Matches ExLibris repository implementation
✅ **Cleaner separation of concerns** - We create, NDE registers and inserts

### Lessons Learned

1. **Never call `customElements.define()` in customModule projects** - NDE framework handles this
2. **Component selector ≠ mapping key** - They serve different purposes:
   - Component selector: The actual custom element tag name
   - Mapping key: NDE insertion point + position suffix
3. **Always reference official ExLibris repository** for canonical implementation patterns
4. **Position suffixes are instructions for NDE**, not part of the custom element name
5. **`getComponentRef()` method is the bridge** - NDE calls this to get our custom element constructors

### References
- Official ExLibris Repository: https://github.com/ExLibrisGroup/customModule
- ExLibris app.module.ts (canonical implementation): https://github.com/ExLibrisGroup/customModule/blob/main/src/app/app.module.ts
- Angular Elements Documentation: Component selector separation best practice
- Console log showing NDE detection: `lookup.service.ts:107`

---

## Bug #1: FilterAssistPanel Breaking Primo UI Rendering (Fixed: 2025-11-09)

### Symptoms
- When `FilterAssistPanelMountService` was enabled, the Primo NDE filter panel displayed broken HTML rendering
- The "Expand my results" label showed raw HTML code instead of rendering properly:
  ```html
  <a target="_blank" href="..."><font color="#a3a3a3">What does this mean?</font></a>
  ```
- Filter panel functionality was degraded
- Performance issues due to excessive DOM monitoring

### Root Cause
**Incorrect component insertion method** - Manual DOM manipulation instead of using NDE's official selector-based integration system.

#### What Was Wrong:

1. **Manual DOM Injection** (`filter-assist-panel.mount.service.ts`):
   ```typescript
   // WRONG APPROACH - Manual DOM manipulation
   const element = this.document.createElement(PANEL_TAG);
   element.setAttribute(PANEL_DATA_ATTR, PANEL_DATA_VALUE);
   host.insertBefore(element, host.firstElementChild ?? null);
   ```

2. **Custom Selector** (`customComponentMappings.ts`):
   ```typescript
   // WRONG - Custom selector not managed by NDE
   ['tau-filter-assist-panel', FilterAssistPanelComponent]
   ```

3. **Performance Issues**:
   - `MutationObserver` watching entire `document.body` with `subtree: true`
   - Triggered on every DOM change across the entire page
   - Massive overhead for simple component mounting

4. **Angular Change Detection Broken**:
   - Manually inserting elements into Angular-managed DOM regions
   - Primo's Angular change detection couldn't track the custom element
   - Caused HTML to be escaped/sanitized incorrectly

### The Fix

Used **NDE's official selector-based component insertion system** instead of manual DOM manipulation.

#### Changes Made:

1. **Updated Component Mapping** (`src/app/custom1-module/customComponentMappings.ts`):
   ```typescript
   // CORRECT - Using NDE official selector with -top suffix
   ['nde-search-filters-side-nav-top', FilterAssistPanelComponent]
   ```

2. **Removed Manual DOM Service** (`src/app/app.module.ts`):
   ```typescript
   // Removed FilterAssistPanelMountService injection from constructor
   // No longer needed - NDE framework handles component insertion
   ```

3. **Deleted Obsolete Service**:
   - Removed `src/app/custom1-module/filter-assist-panel/filter-assist-panel.mount.service.ts`
   - No manual DOM manipulation required

### NDE Component Insertion Methods

According to NDE documentation, components should be inserted using official selectors with position suffixes:

| Suffix | Insertion Position | Effect |
|--------|-------------------|--------|
| `-before` | Before the NDE component | Element appears outside and above |
| `-after` | After the NDE component | Element appears outside and below |
| `-top` | First element within component | Element is inside wrapper, before content |
| `-bottom` | Last element within component | Element is inside wrapper, after content |
| (none) | Replaces component | Original component completely overridden |

### Results

✅ **HTML renders correctly** - Angular change detection works properly
✅ **No performance issues** - No MutationObserver watching entire page
✅ **Cleaner code** - Removed ~65 lines of unnecessary service code
✅ **Follows NDE best practices** - Using official integration method

### Lessons Learned

1. **Always use NDE's official selector system** for component insertion
2. **Never manually manipulate DOM** in Angular-managed regions
3. **Read framework documentation carefully** before implementing custom solutions
4. **Manual DOM injection breaks Angular's change detection** and sanitization
5. **MutationObserver on document.body is a performance anti-pattern**

### References
- NDE Customization Documentation (Vimeo: 1127341448/46bd5c62f2)
- NDE Component Selector Mapping: `customComponentMappings.ts`
- Available NDE Selectors: [`docs/reference/nde_dom_search_part.txt`](../reference/nde_dom_search_part.txt)

---

## Additional Notes

### Source Map Upload Issue (Fixed: 2025-11-09)

**Symptom**: Alma BO rejected ZIP upload with error: "File type map is not allowed in the zip file"

**Cause**: Webpack production config generating source maps (`devtool: 'source-map'`)

**Fix**: Disabled source maps in `webpack.prod.config.js`:
```javascript
devtool: false, // Disabled source maps for Alma BO upload
```

**Result**: Package size reduced from 1.05MB to 570KB (45% smaller)
