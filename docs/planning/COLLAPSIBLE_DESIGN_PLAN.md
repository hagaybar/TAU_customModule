# Collapsible Design Implementation Plan
## Filter Assist Panel - NDE Design Language Integration

**Date:** 2025-11-11
**Status:** Planning Phase
**Previous Attempt:** Failed - See `docs/troubleshooting/COLLAPSIBLE_DESIGN_ISSUES.md`

---

## Executive Summary

This document provides a comprehensive plan to redesign the FilterAssistPanel component to use Angular Material's expansion panel pattern, matching the NDE filter design language with collapsible +/- icons.

The previous attempt failed due to:
1. Incorrect content structure in expansion panel
2. Missing change detection triggers
3. CSS specificity issues
4. Insufficient incremental testing

This plan addresses these issues with a phased, test-driven approach.

---

## Root Cause Analysis

### Issue 1: Links Not Displayed ⚠️

**What Happened:**
- The `<ul class="external-search-list">` was placed directly inside `<mat-expansion-panel>` after the header
- Angular Material expansion panels have a specific internal structure that wasn't followed

**Root Cause:**
```html
<!-- INCORRECT (What we did) -->
<mat-expansion-panel>
  <mat-expansion-panel-header>...</mat-expansion-panel-header>
  <ul>...</ul>  <!-- ❌ Rendered but potentially hidden/unstyled -->
</mat-expansion-panel>

<!-- CORRECT (What it should be) -->
<mat-expansion-panel>
  <mat-expansion-panel-header>...</mat-expansion-panel-header>
  <!-- Angular Material automatically wraps content here in .mat-expansion-panel-content -->
  <!-- But we need to ensure it's not hidden by our CSS or OnPush -->
  <ng-template matExpansionPanelContent>  <!-- Optional lazy loading -->
    <ul>...</ul>
  </ng-template>
</mat-expansion-panel>
```

**Technical Details:**
- Angular Material v18 uses a specific DOM structure with wrapper divs
- Content after header should automatically work, BUT:
  - CSS might be hiding it (`display: none`, `height: 0`, etc.)
  - `OnPush` change detection might not be triggering renders
  - Z-index or positioning issues

**Evidence from NDE Reference:**
```html
<div class="mat-expansion-panel-content-wrapper" inert="">  <!-- Note: inert when collapsed -->
  <div role="region" class="mat-expansion-panel-content">
    <div class="mat-expansion-panel-body">
      <!-- ACTUAL CONTENT HERE -->
    </div>
  </div>
</div>
```

The `inert` attribute on collapsed state prevents interaction and may affect visibility.

---

### Issue 2: Expansion Functionality Not Working 🔄

**What Happened:**
- Clicking the header or + icon didn't expand/collapse the panel
- The `isExpanded` property may have changed, but UI didn't update

**Root Cause:**

**A. Change Detection Issue**
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,  // ⚠️ This requires manual triggers
})
export class FilterAssistPanelComponent {
  public isExpanded = false;  // Changing this primitive doesn't trigger OnPush
}
```

With `OnPush`, Angular only checks for:
- Input property reference changes
- Events from the template
- Manual `ChangeDetectorRef.markForCheck()`

The `[(expanded)]` two-way binding might not trigger change detection properly.

**B. Event Propagation**
- The custom `add-icon` div might be blocking click events from reaching the expansion panel header
- Need to ensure proper event bubbling

**Solutions:**
1. Inject `ChangeDetectorRef` and call `markForCheck()` after state changes
2. Use `(opened)` and `(closed)` events from Material instead of two-way binding
3. Remove custom click handlers that might interfere

---

### Issue 3: Title Text Wrapping ("Search also in" → Two Lines) 📝

**What Happened:**
- Title displayed as:
  ```
  Search
  also in
  ```

**Root Cause:**

**A. Flex Column Direction**
```html
<mat-panel-title class="flex-column">  <!-- ❌ This makes children stack vertically -->
  <h3>{{ panelTitle }}</h3>
</mat-panel-title>
```

Looking at NDE reference:
```html
<mat-panel-title class="flex-column">
  <h3>Creation Date</h3>
  <span class="picked-filters"><!----></span>  <!-- This is for selected filter chips -->
</mat-panel-title>
```

The `flex-column` is intended for stacking the title and selected filter chips, NOT for wrapping text. Our single h3 shouldn't use this class.

**B. Insufficient Width**
- The panel title area might not have enough width
- Need to check `mat-panel-title` width constraints

**Solutions:**
1. Remove `flex-column` or use a different layout
2. Ensure adequate width for title text
3. Add `white-space: nowrap` if single line is required
4. Consider responsive behavior for long translations

---

### Issue 4: Visual Misalignment and Styling 🎨

**What Happened:**
- Component didn't blend with native NDE filters
- Spacing, borders, and hover states were off

**Root Cause:**

**A. CSS Specificity Wars**
```scss
.filter-assist-wrapper {
  .filter-group-panel {
    box-shadow: none;  // Might be overridden by Material's styles
    background: transparent;
  }
}
```

Material's styles are highly specific. Our selectors might not be strong enough.

**B. Missing Material Theme Variables**
- Used hardcoded colors instead of theme CSS variables
- NDE might have custom theme overrides we're not inheriting

**C. Incorrect Class Usage**
- `margin-top-big` might not be a standard NDE class
- Need to verify actual class names used in production

**Solutions:**
1. Use `::ng-deep` or `:host ::ng-deep` for deep style penetration (with caution)
2. Import and use Material theme mixins
3. Inspect NDE's actual computed styles and copy them exactly
4. Test in actual NDE environment, not just localhost

---

## Detailed Implementation Plan

### Phase 1: Pre-Implementation Research 🔍

**Objective:** Gather all necessary information before coding

#### Step 1.1: Verify Angular Material Version
```bash
npm list @angular/material
# Confirm version 18.2.9 and check changelog
```

**Action Items:**
- [ ] Check if version 18.2.9 has known issues with expansion panels
- [ ] Review Material documentation for v18 expansion panel API
- [ ] Check for breaking changes from v17 to v18

#### Step 1.2: Inspect NDE DOM in Production
**Using Browser DevTools in live NDE environment:**

1. Navigate to live TAU NDE instance with filters
2. Open "All Filters" sidebar
3. Inspect a native filter (e.g., "Availability")
4. Copy entire HTML structure including:
   - All classes on `mat-expansion-panel`
   - All classes on `mat-expansion-panel-header`
   - The exact icon SVG structure
   - The content wrapper structure
5. Inspect computed CSS styles for:
   - `mat-expansion-panel`
   - `mat-expansion-panel-header`
   - `.mat-expansion-panel-body`
   - Typography classes (`mat-title-medium`)

**Save findings to:** `docs/reference/nde_filter_computed_styles.md`

#### Step 1.3: Test Minimal Expansion Panel
**Create a test component to verify basic functionality:**

```bash
ng generate component custom1-module/test-expansion-panel
```

**Minimal test code:**
```typescript
@Component({
  selector: 'test-expansion-panel',
  standalone: true,
  imports: [MatExpansionModule],
  template: `
    <mat-expansion-panel>
      <mat-expansion-panel-header>
        <mat-panel-title>Test Title</mat-panel-title>
      </mat-expansion-panel-header>
      <p>Test content that should appear when expanded</p>
    </mat-expansion-panel>
  `
})
export class TestExpansionPanelComponent {}
```

**Test in NDE context:**
- Add to `customComponentMappings.ts` temporarily
- Deploy and test in actual NDE environment
- Verify expansion works
- Verify content displays

**Success Criteria:**
- [ ] Panel expands/collapses on click
- [ ] Content is visible when expanded
- [ ] Styling matches NDE reasonably well

If this fails, we have a fundamental compatibility issue with Material in NDE context.

#### Step 1.4: Research NDE Component Lifecycle
**Questions to investigate:**
1. How does NDE inject custom components?
2. Are there lifecycle timing issues?
3. Does NDE use ViewEncapsulation that might affect styles?
4. Are there Angular zone issues?

**Resources:**
- NDE documentation in `docs/research/NDE_INTEGRATION_RESEARCH.md`
- ExLibris documentation
- Angular Elements behavior (since NDE uses micro-frontends)

---

### Phase 2: Incremental Implementation 🔨

**Objective:** Build the feature step-by-step with testing at each stage

#### Step 2.1: Branch Management
```bash
git checkout main
git pull
git checkout -b feature/collapsible-design-v2
```

#### Step 2.2: Add Material Modules (Step 1)

**File:** `filter-assist-panel.component.ts`

```typescript
// Add imports
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  imports: [
    CommonModule,
    AutoAssetSrcDirective,
    MatExpansionModule,  // ✅ Step 1: Just add the module
    MatIconModule
  ],
  // Keep OnPush for now, will inject ChangeDetectorRef
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterAssistPanelComponent {
  // Inject ChangeDetectorRef
  constructor(
    private searchQueryService: SearchQueryService,
    private registry: FilterAssistPanelRegistryService,
    private cdr: ChangeDetectorRef  // ✅ For manual change detection
  ) {}
}
```

**Test:**
```bash
npm run build
```

**Success Criteria:**
- [ ] Build succeeds with no errors
- [ ] No console errors in browser
- [ ] Component still renders as before

**Commit:** `git commit -m "Add Material expansion modules to FilterAssistPanel"`

---

#### Step 2.3: Add Expansion State Management (Step 2)

**File:** `filter-assist-panel.component.ts`

```typescript
export class FilterAssistPanelComponent {
  // Add expansion state
  public isExpanded = false;

  // Add event handlers
  onPanelOpened(): void {
    console.log('Panel opened');
    this.isExpanded = true;
    this.cdr.markForCheck();  // ✅ Trigger change detection
  }

  onPanelClosed(): void {
    console.log('Panel closed');
    this.isExpanded = false;
    this.cdr.markForCheck();  // ✅ Trigger change detection
  }
}
```

**Test:**
- Build and deploy
- Check console logs
- Component still works as before

**Commit:** `git commit -m "Add expansion state management"`

---

#### Step 2.4: Wrap Existing Content in Expansion Panel (Step 3)

**File:** `filter-assist-panel.component.html`

**Strategy: Wrap, don't rewrite**

```html
<section
  *ngIf="shouldRender && hasSearchQuery()"
  [attr.dir]="textDirection"
  class="external-search-panel">

  <!-- ✅ WRAP existing content in expansion panel -->
  <mat-expansion-panel
    [expanded]="isExpanded"
    (opened)="onPanelOpened()"
    (closed)="onPanelClosed()"
    hideToggle>

    <mat-expansion-panel-header>
      <mat-panel-title>
        <h3 class="external-search-panel__title">
          {{ panelTitle }}
        </h3>
      </mat-panel-title>
    </mat-expansion-panel-header>

    <!-- ✅ Keep existing working list code EXACTLY as is -->
    <ul class="external-search-panel__list" role="list">
      <li *ngFor="let source of externalSources" class="external-search-panel__item">
        <a [href]="buildExternalUrl(source)"
           target="_blank"
           rel="noopener noreferrer"
           class="external-search-panel__link"
           [attr.aria-label]="'Search in ' + getSourceName(source) + ' (opens in new window)'">

          <img autoAssetSrc [src]="source.img" [alt]="source.alt"
               class="external-search-panel__icon" width="16" height="16">

          <span class="external-search-panel__name">{{ getSourceName(source) }}</span>

          <svg class="external-search-panel__external-icon"
               xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
               width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
        </a>
      </li>
    </ul>

  </mat-expansion-panel>

</section>
```

**Test:**
```bash
npm run build
npm run start
```

**Success Criteria:**
- [ ] Panel header displays with title
- [ ] Clicking header expands/collapses (check console logs)
- [ ] **CRITICAL**: Links are visible when expanded
- [ ] Links work and open correct URLs
- [ ] If links are NOT visible, check:
  - [ ] Browser DevTools - inspect `.mat-expansion-panel-body`
  - [ ] Check if `display: none` or `height: 0`
  - [ ] Check if `inert` attribute is preventing display

**If links are not visible at this step:**

**Debugging Actions:**
1. Open DevTools and inspect the expansion panel
2. Look for `.mat-expansion-panel-content` wrapper
3. Check computed styles - look for `display`, `height`, `visibility`
4. Try removing `OnPush` temporarily:
   ```typescript
   changeDetection: ChangeDetectionStrategy.Default,
   ```
5. Try using `ngAfterViewInit` to manually expand:
   ```typescript
   ngAfterViewInit() {
     setTimeout(() => {
       this.isExpanded = true;
       this.cdr.detectChanges();
     }, 100);
   }
   ```

**Commit if successful:** `git commit -m "Wrap content in expansion panel - basic structure working"`

---

#### Step 2.5: Add Custom + Icon (Step 4)

**Only proceed if Step 2.4 is successful**

**File:** `filter-assist-panel.component.html`

```html
<mat-expansion-panel-header>
  <mat-panel-title>
    <!-- ❌ Remove flex-column class -->
    <h3 class="external-search-panel__title">
      {{ panelTitle }}
    </h3>
  </mat-panel-title>

  <!-- ✅ Add icon in description section -->
  <mat-panel-description>
    <button
      type="button"
      class="expansion-icon-button"
      [attr.aria-label]="isExpanded ? 'Collapse' : 'Expand'"
      (click)="$event.stopPropagation()">

      <mat-icon color="primary" class="expansion-icon">
        <svg width="16" height="16" viewBox="0 0 16 16"
             preserveAspectRatio="xMidYMid meet" focusable="false">
          <!-- Horizontal line (always visible) -->
          <path d="M0 8H16" stroke="currentColor" stroke-width="2" />
          <!-- Vertical line (only when collapsed) -->
          <path *ngIf="!isExpanded"
                d="M8 0L8 16" stroke="currentColor" stroke-width="2" />
        </svg>
      </mat-icon>
    </button>
  </mat-panel-description>
</mat-expansion-panel-header>
```

**Test:**
- [ ] + icon visible when collapsed
- [ ] - icon (minus only) visible when expanded
- [ ] Icon color matches NDE primary color
- [ ] Title stays on one line

**Commit:** `git commit -m "Add custom +/- expansion icon"`

---

#### Step 2.6: Minimal Styling (Step 5)

**File:** `filter-assist-panel.component.scss`

**Strategy: Start minimal, only add what's necessary**

```scss
// Keep ALL existing working styles
.external-search-panel {
  // ... keep everything as is ...

  // Add ONLY expansion panel specific styles

  ::ng-deep {
    // Remove Material's default panel styling
    .mat-expansion-panel {
      box-shadow: none !important;
      background: transparent !important;

      &::before {
        box-shadow: none !important;  // Remove elevation
      }
    }

    .mat-expansion-panel-header {
      padding: 0 !important;
      height: auto !important;
      background: transparent !important;

      &:hover {
        background: transparent !important;
      }
    }

    .mat-expansion-panel-body {
      padding: 0 !important;
    }
  }

  // Custom icon styling
  .expansion-icon-button {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
      border-radius: 50%;
    }
  }

  .expansion-icon {
    width: 24px;
    height: 24px;

    svg path {
      stroke: var(--mat-sys-primary, #1976d2);
    }
  }
}
```

**Test:**
- [ ] Panel looks similar to before
- [ ] No double borders or backgrounds
- [ ] Icon styled correctly

**Commit:** `git commit -m "Add minimal expansion panel styling"`

---

### Phase 3: Visual Polish 🎨

**Only proceed if Phase 2 is 100% successful**

#### Step 3.1: Match NDE Typography

**Reference NDE's actual classes:**
```scss
.external-search-panel__title {
  // Copy exact styles from NDE's .mat-title-medium
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  letter-spacing: 0.00625rem;
  margin: 0;
}
```

#### Step 3.2: Match NDE Spacing

**Measure and copy exact padding/margins from NDE filters:**
```scss
.mat-expansion-panel-header {
  padding: 16px 24px !important;  // Measure from DevTools
}

.mat-expansion-panel-body {
  padding: 0 24px 16px 24px !important;
}
```

#### Step 3.3: Add Divider

```html
<mat-expansion-panel>
  <!-- ... content ... -->
</mat-expansion-panel>

<mat-divider class="filter-divider"></mat-divider>
```

```scss
.filter-divider {
  margin-top: 16px;
  border-top-color: rgba(0, 0, 0, 0.12);
}
```

#### Step 3.4: Responsive Design

Test at different viewport sizes:
- Desktop: 1920px, 1366px
- Tablet: 768px
- Mobile: 375px

---

### Phase 4: Testing & Validation ✅

#### Test Checklist

**Functional Tests:**
- [ ] Panel expands when clicking header
- [ ] Panel collapses when clicking header
- [ ] + icon changes to - when expanded
- [ ] All links are visible when expanded
- [ ] Links open correct URLs in new tab
- [ ] Component only renders when search query exists
- [ ] Only one instance renders (registry service works)

**Visual Tests:**
- [ ] Title displays on single line (English)
- [ ] Title displays correctly (Hebrew RTL)
- [ ] Icon aligns properly with title
- [ ] Spacing matches native NDE filters
- [ ] Hover states match NDE filters
- [ ] Focus states are accessible (keyboard navigation)

**Cross-Browser Tests:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge

**Accessibility Tests:**
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces expand/collapse state
- [ ] ARIA labels are correct
- [ ] Focus indicators are visible

**Performance Tests:**
- [ ] No console errors
- [ ] No memory leaks (test with repeated expand/collapse)
- [ ] Animation is smooth (60fps)

---

### Phase 5: Documentation & Deployment 📚

#### Step 5.1: Update Documentation

Create/update these files:
- `docs/features/external-search/COLLAPSIBLE_DESIGN.md` - Technical documentation
- `SPECS.md` - Update with new UX behavior
- `README.md` - Update screenshots if needed

#### Step 5.2: Commit Strategy

```bash
# Squash commits into logical units
git rebase -i main

# Suggested commit structure:
# 1. "Add Material expansion panel infrastructure"
# 2. "Implement collapsible filter panel design"
# 3. "Add visual styling to match NDE filters"
# 4. "Update documentation for collapsible design"
```

#### Step 5.3: Merge to Main

```bash
git checkout main
git merge --no-ff feature/collapsible-design-v2 -m "Implement collapsible design for FilterAssistPanel"
git tag -a v2.1.0 -m "Collapsible filter panel design"
```

---

## Risk Mitigation Strategies

### Risk 1: Material Components Don't Work in NDE Context

**Mitigation:**
- Test minimal expansion panel first (Step 1.3)
- Have fallback plan: CSS-only accordion
- Consider using plain HTML + CSS animations instead

**Fallback Plan: CSS-Only Accordion**
```html
<div class="custom-accordion" [class.expanded]="isExpanded">
  <div class="accordion-header" (click)="toggleExpansion()">
    <h3>{{ panelTitle }}</h3>
    <span class="icon">{{ isExpanded ? '-' : '+' }}</span>
  </div>
  <div class="accordion-body" [@expandCollapse]="isExpanded ? 'expanded' : 'collapsed'">
    <ul><!-- links --></ul>
  </div>
</div>
```

### Risk 2: Change Detection Issues Persist

**Mitigation:**
- Switch to `ChangeDetectionStrategy.Default` if necessary
- Use `Observable` instead of primitive for `isExpanded`
- Use `async` pipe in template

### Risk 3: Styling Conflicts with NDE

**Mitigation:**
- Use very specific selectors
- Test in production-like environment
- Use `!important` sparingly but when necessary
- Consider Shadow DOM encapsulation

### Risk 4: Accessibility Regressions

**Mitigation:**
- Test with keyboard from day one
- Use axe DevTools to check accessibility
- Maintain ARIA labels throughout
- Test with screen reader (NVDA/JAWS/VoiceOver)

---

## Success Metrics

### Must Have (Blockers for Merge)
✅ All links visible and functional
✅ Expansion/collapse works reliably
✅ No console errors or warnings
✅ Keyboard accessible
✅ Works in Chrome and Firefox
✅ English and Hebrew both work

### Should Have (Can be follow-up)
- Perfect visual match with NDE filters
- Smooth animations
- Safari/Edge compatibility
- Perfect RTL layout
- Responsive design polish

### Nice to Have
- Animation performance optimization
- Custom theme integration
- Advanced accessibility features

---

## Lessons from Previous Attempt

### What Went Wrong
1. ❌ No incremental testing
2. ❌ Complete rewrite instead of gradual enhancement
3. ❌ Didn't test in actual NDE environment before declaring success
4. ❌ Ignored change detection implications
5. ❌ Over-styled too early

### What To Do Differently
1. ✅ Test after every single change
2. ✅ Keep working code, wrap gradually
3. ✅ Deploy to test environment at each step
4. ✅ Handle change detection explicitly
5. ✅ Minimal styling first, polish later

---

## Timeline Estimate

**Phase 1 (Research):** 2-3 hours
**Phase 2 (Implementation):** 3-4 hours
**Phase 3 (Polish):** 1-2 hours
**Phase 4 (Testing):** 2-3 hours
**Phase 5 (Documentation):** 1 hour

**Total:** 9-13 hours of focused work

**Recommended:** Split across 2-3 days with testing breaks

---

## Appendix A: Material Expansion Panel API Reference

### Component Properties
```typescript
@Input() expanded: boolean  // Current expansion state
@Input() hideToggle: boolean  // Hide default toggle icon
@Input() disabled: boolean  // Disable expansion

@Output() opened: EventEmitter<void>  // Fired after expansion
@Output() closed: EventEmitter<void>  // Fired after collapse
@Output() expandedChange: EventEmitter<boolean>  // Two-way binding
```

### CSS Classes
- `.mat-expansion-panel` - Root element
- `.mat-expansion-panel-header` - Clickable header
- `.mat-expansion-panel-content` - Content wrapper (auto-generated)
- `.mat-expansion-panel-body` - Inner content (auto-generated)
- `.mat-expanded` - Added when expanded

---

## Appendix B: Debugging Commands

```bash
# Check Material version
npm list @angular/material

# Run with source maps
npm run start -- --source-map

# Build with detailed output
npm run build -- --verbose

# Check for circular dependencies (can cause change detection issues)
npx madge --circular --extensions ts src/

# Analyze bundle size
npm run build -- --stats-json
npx webpack-bundle-analyzer dist/stats.json
```

---

## Appendix C: Contact & Resources

**Angular Material Docs:**
- https://material.angular.io/components/expansion/overview

**NDE Integration:**
- ExLibris Developer Network
- Internal docs: `docs/research/NDE_INTEGRATION_RESEARCH.md`

**Git Branches:**
- Failed attempt: `feature/filter-assist-collapsible-design`
- New attempt: `feature/collapsible-design-v2`

---

**Plan Status:** ✅ READY FOR IMPLEMENTATION
**Next Step:** Phase 1.1 - Verify Angular Material Version
**Owner:** TAU Development Team
**Review Date:** After Phase 2 completion
