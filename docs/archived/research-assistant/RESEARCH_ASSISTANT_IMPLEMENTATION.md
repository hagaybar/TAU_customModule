# Research Assistant Text Customization - Implementation Guide

## Overview

This customization splits the Research Assistant description text into two styled parts using custom Alma labels that support multiple languages.

**Status**: ✅ Implemented and Working
**Date**: 2025-11-13
**Branch**: `ra-message`

---

## Solution Architecture

### Approach
Component-based customization using the `nde-research-assistant-after` hook.

### Why This Approach?
- ✅ Uses official NDE component hooks
- ✅ Integrates with NDE's component lifecycle
- ✅ Automatically handles language changes
- ✅ Clean, maintainable code structure
- ✅ Works with Alma's translation system

### Alternative Approaches Considered
1. **Service-based** (initially attempted) - More complex, harder to maintain
2. **Component replacement** - Too risky, breaks NDE functionality
3. **AngularJS custom.js** (legacy) - Not compatible with Angular custom modules

---

## Technical Details

### Shadow DOM Access

The Research Assistant uses a **closed shadow DOM** structure:

```
cdi-research-assistant (host element)
  └─ #shadow-root (open)
      └─ #landing > div > div.w-full.text-center > p
          └─ TARGET PARAGRAPH (text to modify)
```

**Access Pattern:**
```typescript
const host = document.querySelector('cdi-research-assistant');
const paragraph = host.shadowRoot.querySelector('#landing > div > div.w-full.text-center > p');
```

### Custom Alma Labels

**Configuration in Alma Back Office:**
- Navigate to: Configuration Menu → General → NDE Code Table
- Create custom labels:

| Label Key | Usage |
|-----------|-------|
| `nde-ra-first-row` | First line of text (bold) |
| `nde-ra-second-row` | Second line of text (gray) |

**Language Support:**
- Define translations for each language (en, he, etc.)
- Translations are automatically fetched based on current UI language

### Styling

Custom CSS injected into shadow DOM:

```css
.tau-ra-first-part {
  display: block;
  margin-bottom: 1rem;
  font-weight: bold;
}

.tau-ra-second-part {
  display: block;
  color: #666666;
}
```

---

## Implementation

### Component Registration

**File**: `src/app/custom1-module/customComponentMappings.ts`

```typescript
['nde-research-assistant-after', ResearchAssistantTextComponent]
```

### Component Implementation

**File**: `src/app/custom1-module/research-assistant-test/research-assistant-test.component.ts`

**Key Features:**
1. **Shadow DOM Access**: Finds and accesses `cdi-research-assistant` shadow DOM
2. **Translation Integration**: Uses `TranslateService` to fetch custom Alma labels
3. **Language Change Detection**: Subscribes to `onLangChange` events
4. **Dynamic Updates**: Re-applies text modifications when language switches

**Lifecycle:**
```
ngOnInit()
  ├─ modifyResearchAssistantText() [initial]
  └─ subscribeToLanguageChanges()
      └─ on language change → modifyResearchAssistantText() [update]
```

### Modification Logic

```typescript
// 1. Find host element
const host = document.querySelector('cdi-research-assistant');

// 2. Access shadow DOM
const shadowRoot = host.shadowRoot;

// 3. Find target paragraph
const paragraph = shadowRoot.querySelector('#landing > div > div.w-full.text-center > p');

// 4. Get translated text
const firstRow = await translateService.get('nde-ra-first-row').toPromise();
const secondRow = await translateService.get('nde-ra-second-row').toPromise();

// 5. Inject custom styles
const styles = document.createElement('style');
styles.id = 'tau-ra-custom-styles';
shadowRoot.appendChild(styles);

// 6. Replace paragraph content with styled spans
paragraph.innerHTML = '';
paragraph.appendChild(styledWrapper);
```

---

## Configuration

### 1. Alma Back Office Setup

**Create Custom Labels:**
1. Go to: Configuration Menu → General → NDE Code Table
2. Click "Add Row"
3. Add these labels with your desired text:

**English (en):**
- `nde-ra-first-row`: "Ask research questions. Explore new topics. Discover credible sources."
- `nde-ra-second-row`: "Please note: This AI Research Assistant tool is in beta version..."

**Hebrew (he):**
- `nde-ra-first-row`: "שאל שאלות מחקר. חקור נושאים חדשים. גלה מקורות אמינים."
- `nde-ra-second-row`: "לתשומת ליבך: כלי עוזר המחקר בינה מלאכותית זה..."

4. Save and deploy changes

### 2. Build & Deploy

```bash
# Build the custom module
npm run build

# Upload to Alma
# File: dist/972TAU_INST-NDE_TEST.zip
```

---

## Testing

### Test Scenarios

✅ **Initial Load (English)**
- Navigate to Research Assistant page with `lang=en`
- Verify first line is bold
- Verify second line is gray
- Check text matches English labels

✅ **Language Switch**
- Switch to Hebrew in UI
- Verify text updates to Hebrew
- Verify styling preserved

✅ **Page Reload**
- Reload page in Hebrew
- Verify correct Hebrew text appears
- Verify styling preserved

### Console Verification

Look for these logs:
```
🎯 === MODIFYING RESEARCH ASSISTANT TEXT ===
🎯 Step 1: Found cdi-research-assistant: true
🎯 Step 2: Found shadow DOM: true
🎯 Step 3: Found target paragraph: true
🎯 Step 4: Retrieved translations
  - First row: [your text]
  - Second row: [your text]
✅ Step 6: Successfully modified paragraph text!
🎯 === TEXT MODIFICATION COMPLETE ===
```

---

## Troubleshooting

### Issue: Text not modified

**Check:**
1. Console shows `cdi-research-assistant: true`?
2. Custom labels exist in Alma for current language?
3. Component is registered in `customComponentMappings.ts`?

**Common Causes:**
- Labels not defined in Alma Back Office
- Wrong language code (check URL parameter `lang=`)
- Shadow DOM access blocked (check browser console)

### Issue: Text reverts on language change

**Check:**
1. Language change subscription is active?
2. Console shows `🌐 ⚡ LANGUAGE CHANGED!`?
3. Labels exist for target language?

**Solution:**
Ensure `subscribeToLanguageChanges()` is called in `ngOnInit()`

### Issue: Styling not applied

**Check:**
1. Style element has ID `tau-ra-custom-styles`?
2. Styles injected into shadow DOM (not regular DOM)?
3. Check browser DevTools → Elements → `#shadow-root`

---

## Migration from Legacy (custom.js)

### Comparison

| Aspect | Legacy (custom.js) | Current (Angular) |
|--------|-------------------|-------------------|
| Framework | AngularJS | Angular 18 |
| Hook | `prm-research-assistant-after` | `nde-research-assistant-after` |
| Element | `cdi-research-assistant` | `cdi-research-assistant` ✓ |
| Selector | `p.text-xl.mt-3` | `#landing > div > div > p` |
| Translation | `$translate` | `TranslateService` |
| Lang Change | `$scope.$watch` | `onLangChange.subscribe()` |

### Migration Steps

1. ✅ Identify element (still `cdi-research-assistant`)
2. ✅ Update selector to use ID-based path
3. ✅ Replace `$translate` with `TranslateService`
4. ✅ Replace `$scope.$watch` with RxJS subscription
5. ✅ Update hook suffix to `-after`
6. ✅ Create custom Alma labels

**Status**: Migration Complete ✅

---

## Maintenance

### Updating Text Content

**Don't modify code!** Update text in Alma Back Office:
1. Go to Configuration Menu → General → NDE Code Table
2. Find `nde-ra-first-row` or `nde-ra-second-row`
3. Update text for desired language
4. Save and deploy

### Updating Styling

**File**: `research-assistant-test.component.ts`

Modify the styles in `modifyResearchAssistantText()`:
```typescript
styleSheet.textContent = `
  .tau-ra-first-part {
    display: block;
    margin-bottom: 1rem;
    font-weight: bold;
    /* Add your styles here */
  }
  .tau-ra-second-part {
    display: block;
    color: #666666;
    /* Add your styles here */
  }
`;
```

Then rebuild and deploy.

---

## Files Modified

### Created
- `src/app/custom1-module/research-assistant-test/` (component files)
- `docs/features/research-assistant/RESEARCH_ASSISTANT_IMPLEMENTATION.md` (this file)
- `docs/reference/research_assistant_selectors.md` (technical discovery)
- `docs/reference/investigate_ra_element.js` (debug script)

### Modified
- `src/app/custom1-module/customComponentMappings.ts` - Added component registration
- `src/app/app.module.ts` - Disabled old service-based approach

### Disabled
- `src/app/services/research-assistant-customizer.service.ts` - Service-based approach (kept for reference)

---

## Future Enhancements

### Possible Improvements
1. **Animation**: Add fade-in effect when text updates
2. **Error Recovery**: Add retry logic if shadow DOM not immediately available
3. **Performance**: Debounce language change events
4. **A11y**: Add ARIA labels for screen readers

### NDE Version Compatibility
- **Current**: Works with NDE April 2025 release
- **Element Name**: Still uses `cdi-research-assistant` (not `nde-research-assistant`)
- **Monitor**: Check for element name changes in future NDE releases

---

## References

- Original AngularJS implementation: `docs/reference/ra_2_parts.js`
- NDE Element Discovery: `docs/reference/research_assistant_selectors.md`
- Investigation Script: `docs/reference/investigate_ra_element.js`
- Latest commit: `05c014a` - "added a reference file for Research Assistance message split"

---

## Contact & Support

**Branch**: `ra-message`
**Component**: `ResearchAssistantTestComponent`
**Hook**: `nde-research-assistant-after`
**Status**: Production Ready ✅
