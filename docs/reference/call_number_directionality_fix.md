# Call Number Directionality Fix

## Overview
This document describes CSS fixes for call number directionality issues in both Primo VE and Primo NDE views, ensuring call numbers display correctly (left-to-right) regardless of the page's text direction (RTL/LTR) or UI language parameter.

## Implementation Dates
- **Primo VE**: 06.02.23
- **Primo NDE**: 13.11.25

---

## Primo VE Implementation

### CSS Code

```css
/* 06.02.23 - fix call no. directionality */

prm-opac prm-location-items p.ng-binding:nth-child(2) span:nth-child(5) {
    direction: initial;
    font-weight: bold;
}


prm-opac prm-location-items div.weak-text div:first-child span:nth-child(2) {
  direction: initial;
  display: inline-block;
  font-weight: bold;
}


prm-opac prm-locations span:nth-child(5) {
    direction: initial;
    font-weight: bold;
}
```

### Purpose
- **direction: initial** - Resets the text direction to the browser default, preventing call numbers from being reversed in RTL contexts
- **font-weight: bold** - Makes call numbers stand out for better visibility
- **display: inline-block** - Ensures proper rendering in the weak-text context

### Affected Components
1. **prm-opac prm-location-items** - Location items display
2. **prm-opac prm-locations** - General locations display

### Selectors Breakdown
- `p.ng-binding:nth-child(2) span:nth-child(5)` - Targets call numbers in location items paragraphs
- `div.weak-text div:first-child span:nth-child(2)` - Targets call numbers in weak-text divs
- `prm-locations span:nth-child(5)` - Targets call numbers in locations component

---

## Primo NDE Implementation

### Location
The CSS rules are implemented in: `src/assets/css/custom.css`

### CSS Code

```css
/* Call Number Directionality Fix - NDE View */
/* Targets: <span data-qa="location-call-number"> elements within NDE locations container */
nde-locations-container [data-qa="location-call-number"] {
    direction: ltr;
    unicode-bidi: embed;
    display: inline-block;
}

/* Call Number Directionality Fix - NDE Location Item Brief Properties */
/* Context: Brief properties display as a 3-column table structure */
/*   Column 1: Item availability, Column 2: Item loan policy, Column 3: Item call number */
nde-location-item .getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow] {
    direction: ltr;
    unicode-bidi: embed;
    display: inline-block;
}
```

### Purpose
- **direction: ltr** - Explicitly sets left-to-right directionality for call numbers
- **unicode-bidi: embed** - Creates an isolated bidirectional context, preventing the surrounding RTL context from affecting the call number
- **display: inline-block** - Ensures the directionality is properly contained within the element boundaries

### Example
Call number `892.413 מאו` should always display with the Dewey decimal number (892.413) on the left, followed by the Hebrew author abbreviation (מאו) on the right.

### Affected Components

#### 1. NDE Locations Container
- **Selector**: `nde-locations-container [data-qa="location-call-number"]`
- **Element**: `<span data-qa="location-call-number">892.413 מאו</span>`
- **Strategy**: Uses semantic `data-qa` attribute for reliable targeting
- **Context**: Main locations display within the accordion

#### 2. NDE Location Item Brief Properties
- **Selector**: `nde-location-item .getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow]`
- **Element**: `<span ndetooltipifoverflow="">892.413 מאו</span>`
- **Strategy**: Uses `nth-child(3)` to target the third column in the brief properties table
- **Context**: Collapsed/brief view of location items showing a 3-column layout:
  - Column 1: Item availability (e.g., "הפריט במקום")
  - Column 2: Loan policy (e.g., "השאלה לשבועיים")
  - Column 3: Call number (e.g., "892.413 מאו")
- **Note**: The `nth-child(3)` selector is reliable due to the consistent table structure

### Technical Notes
- **Why not apply LTR to all brief properties?** Hebrew text must maintain RTL directionality. Only call numbers (which start with digits) need LTR treatment.
- **Why not use regex in CSS?** CSS doesn't support content-based pattern matching. The `nth-child(3)` approach relies on the consistent table structure.
- **unicode-bidi: embed vs isolate**: `embed` is used to create a new directional context while still allowing the call number to participate in the surrounding text flow.
