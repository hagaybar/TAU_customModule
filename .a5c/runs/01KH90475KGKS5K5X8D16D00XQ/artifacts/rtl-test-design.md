# RTL Directionality Test Design for CenLib Map Dialog

## Known Issue
In Hebrew UI mode, labels with colons (e.g., 'ספרייה:', 'אוסף:') display with incorrect text direction - the colon appears at the beginning of the string instead of the end due to missing `dir="rtl"` attribute on dialog elements.

## Test Objectives
1. Verify dialog opens correctly in both English and Hebrew modes
2. Verify RTL text direction is applied when UI language is Hebrew
3. Verify labels with colons display correctly (colon at visual end)
4. Verify text alignment matches language direction

## Selectors
- Dialog title: `[mat-dialog-title]` or `h2.mat-mdc-dialog-title`
- Dialog content: `mat-dialog-content`
- Info rows: `.location-info .info-row`
- Labels: `.info-row .label`
- Values: `.info-row .value`
- Close button: `mat-dialog-actions button`

## Test Cases

### TC1: Dialog Opens in English Mode
- Navigate to search with `?lang=en`
- Search for item with shelf mapping
- Click "Shelf Map" button
- Verify dialog opens with English title "Shelf Location Map"
- Verify labels are in English with colons at end

### TC2: Dialog Opens in Hebrew Mode
- Navigate to search with `?lang=he`
- Search for item with shelf mapping
- Click "מפת מדף" button
- Verify dialog opens with Hebrew title "מפת מיקום המדף"
- Verify labels are in Hebrew

### TC3: RTL Direction on Dialog Content (Hebrew)
- Open dialog in Hebrew mode
- Check computed style of `mat-dialog-content` for `direction`
- Expected: `direction: rtl`
- Current (broken): `direction: ltr`

### TC4: RTL Direction on Labels (Hebrew)
- Open dialog in Hebrew mode
- For each `.info-row .label` element:
  - Check computed style `direction` should be `rtl`
  - Check that text ends with colon in visual order

### TC5: Label Text Content Verification
- Open dialog in Hebrew mode
- Verify label texts match expected Hebrew:
  - "ספרייה:" (Library)
  - "אוסף:" (Collection)
  - "מספר קריאה:" (Call Number)
  - "מדור:" (Section)
  - "קומה:" (Floor)

### TC6: Visual Regression - Colon Position
- Open dialog in Hebrew mode
- Take screenshot of dialog
- Verify colon appears at the LEFT side of each label (correct RTL)
- Or verify it does NOT appear at the RIGHT side (incorrect LTR)

### TC7: Compare English vs Hebrew Layout
- Open dialog in English, screenshot
- Open dialog in Hebrew, screenshot
- Verify layouts are mirror images (text alignment flipped)

## Expected vs Current Behavior

### Labels (e.g., "ספרייה:")
| Scenario | Expected (RTL) | Current (Broken LTR) |
|----------|---------------|----------------------|
| Visual display | `ספרייה:` with colon at left | `:ספרייה` with colon at right |
| CSS direction | `rtl` | `ltr` |
| Text alignment | `right` | `left` |

## Fix Approach
Add `[attr.dir]="currentLanguage === 'he' ? 'rtl' : 'ltr'"` to:
1. `<mat-dialog-content>`
2. `<h2 mat-dialog-title>`
3. Potentially individual `.info-row` elements

Ensure CSS handles both scenarios properly.
