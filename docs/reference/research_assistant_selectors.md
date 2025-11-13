# Research Assistant NDE Elements - Documentation

## Date: 2025-11-13

## Research Assistant Page URL
```
https://tau.primo.exlibrisgroup.com/nde/researchAssistant?vid=972TAU_INST:NDE_TEST&lang=en
```

## All NDE Elements Found on Research Assistant Page

Total elements: 14

```
nde-app-layout
nde-app-root
nde-back-to-top
nde-footer
nde-header
nde-language-selector-container
nde-language-selector-presenter
nde-logo
nde-main-menu
nde-research-assistant                              ⭐ Main element
nde-research-assistant-after-from-remote-0          ⭐ Our custom component
nde-skip-links
nde-user-area
nde-user-panel
```

## Key Findings

### Main Research Assistant Element
- **Element**: `nde-research-assistant`
- **Purpose**: The main NDE Research Assistant component
- **Shadow DOM**: Yes (confirmed in original AngularJS code)
- **Contains**: The description paragraph with text we want to customize

### Custom Component Hook Points

#### Option 1: After Hook (Currently Testing)
- **Selector**: `nde-research-assistant-after`
- **Runtime name**: `nde-research-assistant-after-from-remote-0`
  - NDE automatically appends `-from-remote-0` suffix to custom components
- **Position**: Displays AFTER the Research Assistant content
- **Status**: ✅ Working - Component loads and stays visible
- **Component**: `ResearchAssistantTestComponent`

#### Option 2: Before Hook (Not tested)
- **Selector**: `nde-research-assistant-before`
- **Expected runtime name**: `nde-research-assistant-before-from-remote-0`
- **Position**: Would display BEFORE the Research Assistant content
- **Status**: Not tested yet

#### Option 3: Replace Hook (Not tested)
- **Selector**: `nde-research-assistant` (no suffix)
- **Position**: REPLACES the entire Research Assistant component
- **Status**: Not tested yet
- **Risk**: May break functionality if not implemented correctly

## Component Lifecycle

When testing `nde-research-assistant-after`:
```
✅ Constructor called
✅ ngOnInit - Component initialized
✅ NDE element scan executed successfully
✅ ngAfterViewInit - View initialized
❓ ngOnDestroy - Not observed (component stays alive)
```

## Testing Component Details

**File**: `src/app/custom1-module/research-assistant-test/research-assistant-test.component.ts`

**Features**:
- Simple yellow test box with border
- Console logging at each lifecycle stage
- NDE element scanner that lists all `nde-` prefixed elements
- Visible at bottom of Research Assistant page

**Registration**: `src/app/custom1-module/customComponentMappings.ts`
```typescript
['nde-research-assistant-after', ResearchAssistantTestComponent]
```

## Original Requirements

Based on `docs/reference/ra_2_parts.js`:

### Goal
Split the Research Assistant description text into two parts:
1. **First line**: Bold text - "Ask research questions. Explore new topics. Discover credible sources."
2. **Second line**: Gray text - Beta disclaimer about limited information and Hebrew queries

### Original Approach (AngularJS)
- Used `prm-research-assistant-after` hook
- Accessed shadow DOM via `cdi-research-assistant` element (old naming)
- Found paragraph with selector: `p.text-xl.mt-3`
- Split text using translation keys from Alma labels
- Applied custom CSS within shadow DOM

### Current Approach (Angular)
- Using `nde-research-assistant-after` hook (new naming)
- Element changed from `cdi-research-assistant` to `nde-research-assistant`
- Need to access shadow DOM and find the same paragraph
- Translation keys confirmed working via TranslateService

## Next Steps

### Option A: Continue with Component Hook
1. Test `-before` hook to see if it provides better positioning
2. Access the shadow DOM from our component
3. Modify the paragraph content as needed

### Option B: Service-Based Approach (Already Built)
- File: `src/app/services/research-assistant-customizer.service.ts`
- Status: Temporarily disabled for testing
- Approach: Finds `nde-research-assistant`, accesses shadow DOM, modifies paragraph
- Issue: Element selector needs updating from debug findings

### Option C: Replace Component
1. Register as `nde-research-assistant` (without suffix)
2. Completely replace the NDE Research Assistant
3. Recreate all functionality + our customizations
4. Most control but highest risk and maintenance

## Custom Alma Labels Testing

### Custom Label Feature
- Alma provides a code table for custom NDE labels
- Can be accessed via TranslateService
- Test label created: `nde-custom-label-test`

### TranslateService Status
```
✅ ResearchAssistantCustomizer: TranslateService WORKS! Using Alma labels
```

The translation service successfully retrieves Alma label keys:
- `nui.aria.primo_research_assistant.desc.first_line`
- `nui.aria.primo_research_assistant.desc.second_line`

## Recommendations

1. **For Simple Text Addition**: Use `-before` or `-after` hooks
2. **For Text Modification**: Re-enable the service-based customizer with corrected selector
3. **For Complete Control**: Consider replacing the entire component

## Development Workflow Established

1. Make code changes
2. Run `npm run build`
3. Upload `dist/972TAU_INST-NDE_TEST.zip` to Alma BO
4. Refresh page (Ctrl+Shift+R to clear cache)
5. Check console for component logs

## Notes

- The `-from-remote-0` suffix is automatically added by NDE framework
- Components can see all DOM elements, including shadow DOM with proper access
- Lifecycle hooks work as expected in Angular standalone components
- NDE element scanner utility proven useful for discovery
