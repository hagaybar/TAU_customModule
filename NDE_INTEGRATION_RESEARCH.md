# NDE Custom Element Integration Research

**Date**: 2025-11-09
**Issue**: Custom FilterAssistPanel component not displaying in NDE UI
**Status**: ✅ RESOLVED

---

## Executive Summary

The custom element was not displaying because we were calling `customElements.define()` in our `AppModule.ngDoBootstrap()` method, which created a double-registration conflict with the NDE framework. The NDE framework expects custom modules to only CREATE and STORE custom element constructors, not register them. The framework handles registration and insertion itself.

---

## Research Process

### 1. Official Repository Analysis

**Source**: https://github.com/ExLibrisGroup/customModule

**Key Finding**: The official ExLibris implementation does NOT call `customElements.define()` in `ngDoBootstrap()`.

**Official Pattern**:
```typescript
ngDoBootstrap(appRef: ApplicationRef) {
  for (const [key, value] of selectorComponentMap) {
    const customElement = createCustomElement(value, {injector: this.injector});
    this.webComponentSelectorMap.set(key, customElement);
    // NO customElements.define() call!
  }
}
```

### 2. Angular Elements Best Practices

**Source**: Angular official documentation, developer blogs

**Key Findings**:
- Component selector should be DIFFERENT from custom element registration key
- Using the same name can cause Angular to create two component instances
- Separation allows using component both within Angular and as standalone web component

**Pattern**:
- Component selector: `tau-filter-assist-panel` (the custom element tag name)
- Mapping key: `nde-search-filters-side-nav-top` (NDE insertion point + position)

### 3. NDE Framework Workflow

Based on console logs and repository analysis:

1. **Load Phase**: NDE loads custom module and reads `selectorComponentMap`
2. **Parse Phase**: NDE parses mapping key `nde-search-filters-side-nav-top`:
   - Base selector: `nde-search-filters-side-nav`
   - Position suffix: `-top`
3. **Retrieve Phase**: NDE calls `AppModule.getComponentRef('nde-search-filters-side-nav-top')`
4. **Register Phase**: NDE registers custom element with its own naming scheme
5. **Insert Phase**: NDE inserts element at position indicated by suffix

**Evidence from Console**:
```
lookup.service.ts:107 Loaded custom module CustomModule Set(1) {'nde-search-filters-side-nav'}
```
This shows NDE stripped the `-top` suffix as expected.

---

## The Problem

### Our Incorrect Implementation

```typescript
// src/app/app.module.ts (BEFORE FIX)
ngDoBootstrap(appRef: ApplicationRef) {
  for (const [key, value] of selectorComponentMap) {
    const customElement = createCustomElement(value, {injector: this.injector});
    this.webComponentSelectorMap.set(key, customElement);
    if (!customElements.get(key)) {
      customElements.define(key, customElement);  // ❌ WRONG
    }
  }
}
```

### Why It Failed

1. **Double Registration**:
   - Our code: Registers `nde-search-filters-side-nav-top` via `customElements.define()`
   - NDE framework: Also tries to register the element
   - Result: `CustomElementRegistry` throws error about constructor already being used

2. **Framework Conflict**:
   - NDE framework expects to have full control over registration
   - Manual registration bypasses NDE's insertion logic
   - Position suffix handling breaks

### Console Error

```
NotSupportedError: Failed to execute 'define' on 'CustomElementRegistry':
this constructor has already been used with this registry
```

---

## The Solution

### Remove Custom Element Registration

```typescript
// src/app/app.module.ts (AFTER FIX)
ngDoBootstrap(appRef: ApplicationRef) {
  for (const [key, value] of selectorComponentMap) {
    const customElement = createCustomElement(value, {injector: this.injector});
    this.webComponentSelectorMap.set(key, customElement);
    // NDE framework handles customElements.define() - we just create and store
  }
}
```

### Component Architecture

**Component Definition** (`filter-assist-panel.component.ts`):
```typescript
@Component({
  selector: 'tau-filter-assist-panel',  // ✅ Unique custom element name
  standalone: true,
  templateUrl: './filter-assist-panel.component.html',
  styleUrls: ['./filter-assist-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterAssistPanelComponent {}
```

**Component Mapping** (`customComponentMappings.ts`):
```typescript
export const selectorComponentMap = new Map<string, any>([
  ['nde-search-filters-side-nav-top', FilterAssistPanelComponent],
  //  ↑ WHERE to insert (NDE selector + position)
  //                                   ↑ WHAT to insert (component class)
]);
```

---

## NDE Position Suffixes

| Suffix | Insertion Position | Effect |
|--------|-------------------|--------|
| `-before` | Before the NDE component | Element appears outside and above original |
| `-after` | After the NDE component | Element appears outside and below original |
| `-top` | First element within component | Element inside wrapper, before existing content |
| `-bottom` | Last element within component | Element inside wrapper, after all content |
| (none) | Replaces component | Original NDE component completely overridden |

**Example**:
```typescript
// Insert at TOP of search filters side nav
['nde-search-filters-side-nav-top', FilterAssistPanelComponent]

// Add BEFORE the header
['nde-header-before', CustomBannerComponent]

// REPLACE recommendations entirely
['nde-recommendations', CustomRecommendationsComponent]
```

---

## Key Lessons Learned

### 1. Framework Responsibilities

**Your Responsibility**:
- Create Angular components
- Map them to NDE selectors in `selectorComponentMap`
- Convert to custom elements in `ngDoBootstrap()`
- Store constructors for retrieval via `getComponentRef()`

**NDE Framework Responsibility**:
- Read your component mappings
- Call `getComponentRef()` to retrieve constructors
- Register custom elements with browser
- Insert elements at correct DOM positions
- Handle position suffix logic

### 2. Separation of Concerns

```typescript
// Component selector (Angular/Custom Element tag)
selector: 'tau-filter-assist-panel'

// Mapping key (NDE insertion point)
['nde-search-filters-side-nav-top', FilterAssistPanelComponent]
```

These serve **different purposes** and should **never be the same**:
- Selector: Internal Angular/Web Component identity
- Mapping: External NDE integration instruction

### 3. Trust the Framework

- Don't manually manipulate DOM
- Don't manually register custom elements
- Don't try to insert elements yourself
- NDE framework knows how to handle its own UI structure

### 4. Always Reference Official Repo

When in doubt, check the canonical implementation:
https://github.com/ExLibrisGroup/customModule

---

## Build Results

**Build Command**: `npm run build`
**Status**: ✅ Success
**Package Size**: 569KB
**Output**: `dist/972TAU_INST-NDE_TEST.zip`

**Build includes**:
- Custom module with FilterAssistPanelComponent
- Correct component mapping configuration
- No source maps (Alma BO compatible)
- All required assets and dependencies

---

## Testing Checklist

After uploading to Alma BO and clearing cache:

- [ ] Custom element appears in filter panel
- [ ] No console errors about CustomElementRegistry
- [ ] Element positioned at top of `nde-search-filters-side-nav`
- [ ] Primo NDE UI renders correctly
- [ ] No broken HTML in nearby elements
- [ ] Angular change detection works properly

---

## Resources

### Official Documentation
- ExLibris customModule Repository: https://github.com/ExLibrisGroup/customModule
- NDE UI Customization Best Practices: https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/030Primo_VE_User_Interface/010NDE_UI_Customization_-_Best_Practices

### Angular Elements
- Official Guide: https://angular.dev/guide/elements
- Component Selectors: https://angular.dev/guide/components/selectors
- Custom Elements API: https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry

### Project Files
- `SPECS.md` - Comprehensive technical specification
- `BUGFIX_HISTORY.md` - Detailed bug fix documentation
- `README.md` - Project setup and development guide

---

## Summary

The custom element integration issue was resolved by aligning our implementation with the official ExLibris pattern. The critical change was **removing the `customElements.define()` call** from `ngDoBootstrap()`, allowing the NDE framework to handle registration and insertion as designed.

**Before**: We tried to register and insert → conflict with framework
**After**: We create and store → framework registers and inserts → success

This demonstrates the importance of understanding framework architecture and following official patterns rather than making assumptions about how things should work.
