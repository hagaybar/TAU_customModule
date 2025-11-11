# Collapsible Design Implementation Issues

## Branch: `feature/filter-assist-collapsible-design`

## Date: 2025-11-11

## Objective
Attempted to refactor the FilterAssistPanel component to use Angular Material's expansion panel (`mat-expansion-panel`) to match the NDE filter design language with collapsible + symbol.

## Issues Encountered

### 1. **External Search Links Not Displayed**
**Problem:** The external search links (ULI, WorldCat, Google Scholar) are not visible in the UI.
- Only the title "Search also in" and the + expansion icon are displayed
- The list of links that should appear in the panel body is completely missing

**Expected:** Links should be visible either when expanded or collapsed, depending on design choice.

### 2. **Expansion Functionality Broken**
**Problem:** Clicking the + icon or the panel header does not expand the panel to show the links.
- The expansion state changes but no content appears
- Suggests the panel content is either not rendering or is hidden/empty

### 3. **Visual Layout Problems** (See screenshot: `docs/troubleshooting/filters_design_problem.png`)

#### a. Title Text Wrapping
- "Search also in" is broken into two lines:
  - Line 1: "Search"
  - Line 2: "also in"
- Expected: Title should be on a single line

#### b. Poor Alignment
- The + icon appears to the right but with incorrect spacing
- The component doesn't align properly with the surrounding UI elements
- Takes up excessive vertical space with no visible content

#### c. Visual Mismatch with NDE Filters
- While attempting to match NDE filters (like "Availability" and "Material Type" shown below it), the styling is inconsistent
- The panel doesn't blend seamlessly with native NDE components

### 4. **Potential Root Causes**

#### Template Structure Issue
The links are wrapped inside the `mat-expansion-panel` body but may not be rendering due to:
- Incorrect nesting of Angular Material components
- Missing required wrapper divs (`mat-expansion-panel-body`)
- Change detection issues with `OnPush` strategy

#### CSS/SCSS Issues
- Custom SCSS may be conflicting with Material's default styles
- Z-index or display properties might be hiding the content
- The panel body might have `display: none` or `height: 0`

#### Missing Angular Material Configuration
- Material modules may not be properly imported at the app level
- Missing theme configuration for expansion panels
- Potential animation conflicts

### 5. **Build Status**
- Build completed successfully
- Minor SCSS budget warning (10 bytes over 2KB limit)
- No TypeScript compilation errors

## Files Modified

1. `src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.ts`
   - Added Material module imports
   - Added `isExpanded` property

2. `src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.html`
   - Complete restructure using `mat-expansion-panel`
   - Links moved inside panel body

3. `src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.scss`
   - Complete rewrite to match NDE filter styling
   - Removed custom borders/backgrounds

## Decision

**Reverted to previous working version** due to:
- Critical functionality loss (links not visible)
- Poor user experience
- Uncertain root cause requiring significant debugging time

## Lessons Learned

1. **Testing Required:** Should have tested locally before considering the implementation complete
2. **Incremental Changes:** Should have made smaller, testable changes rather than complete rewrite
3. **Material Panel Complexity:** Angular Material expansion panels may have specific requirements or conflicts with NDE's hosting environment
4. **NDE Context:** Custom components in NDE context may have limitations or special considerations for Material components

## Alternative Approaches to Consider

1. **CSS-Only Solution:**
   - Keep existing HTML structure
   - Style it to visually match filters using only CSS
   - Implement collapse/expand with simple Angular logic and CSS transitions

2. **Hybrid Approach:**
   - Keep the current working structure
   - Add a simple toggle button styled like NDE's + icon
   - Use `*ngIf` or CSS classes to show/hide links

3. **Minimal Styling:**
   - Accept that the component doesn't need to be collapsible
   - Focus on visual styling to blend better with filters
   - Keep the simple, working approach

4. **Further Research:**
   - Investigate how NDE implements its filters
   - Check if there are specific directives or services required
   - Review NDE documentation for custom component styling guidelines

## References

- Screenshot: `docs/troubleshooting/filters_design_problem.png`
- Original filter example: `docs/reference/single_filter_group.html`
- Branch preserved for reference: `feature/filter-assist-collapsible-design`

## Status

- Branch: **Preserved** (not deleted) for future investigation
- Main branch: **Restored** to working version
- Issue: **Open** - May revisit with alternative approach
