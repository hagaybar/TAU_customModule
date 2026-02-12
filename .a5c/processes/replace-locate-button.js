/**
 * Process: Replace Locate Button with Shelf Map Button
 *
 * When the cenlib-map component's filters match (library + location configured),
 * hide the existing Primo "Locate" button and show our "Shelf Map" button in its place.
 *
 * Steps:
 * 1. Analyze DOM structure to find Locate button selector
 * 2. Implement the hide/replace logic in the component
 * 3. Update CSS for proper positioning
 * 4. Verify in browser
 */
import pkg from '@a5c-ai/babysitter-sdk';
const { defineTask } = pkg;

// Task 1: Find the Locate button selector by analyzing live DOM
export const findLocateButtonTask = defineTask('find-locate-button', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Find Locate button selector in Primo DOM',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Frontend developer analyzing DOM structure',
      task: `Start the dev server and use Playwright browser tools to find the "Locate" button in the Primo NDE interface.

Steps:
1. Navigate to the Primo search at http://localhost:4201
2. Search for a physical item (e.g., search for "296.851" which has physical availability at Sourasky Central Library)
3. Click on a result to see details
4. Look for the "Locate" button (blue button with pin icon and text "Locate")
5. Use browser_snapshot to capture the DOM structure
6. Identify the exact selector for the Locate button (tag, class, data-qa attribute, etc.)
7. Identify its parent container for positioning our replacement button

Return a JSON object with:
{
  "locateButtonSelector": "the CSS selector that uniquely identifies the Locate button",
  "parentContainerSelector": "the selector for the parent container",
  "buttonStructure": "description of the button HTML structure",
  "proximityToCallNumber": "description of where the button is relative to call number/location info"
}`,
      context: args,
      instructions: [
        'Start the proxy server if not running',
        'Use Playwright browser tools to navigate and inspect',
        'Find the exact selector for the Locate button',
        'Document the DOM structure around it',
        'Return structured JSON'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['locateButtonSelector', 'parentContainerSelector'],
      properties: {
        locateButtonSelector: { type: 'string' },
        parentContainerSelector: { type: 'string' },
        buttonStructure: { type: 'string' },
        proximityToCallNumber: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

// Task 2: Implement the hide/replace logic in the component
export const implementReplaceLogicTask = defineTask('implement-replace-logic', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Implement Locate button replacement logic',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular developer modifying component behavior',
      task: `Modify the cenlib-map-button component to hide the Locate button and show our Shelf Map button in its place.

Based on the DOM analysis:
- Locate button selector: ${args.locateButtonSelector}
- Parent container: ${args.parentContainerSelector}

Files to modify:
1. src/app/custom1-module/cenlib-map/cenlib-map-button.component.ts
2. src/app/custom1-module/cenlib-map/cenlib-map-button.component.scss
3. src/app/custom1-module/customComponentMappings.ts (if needed to change insertion point)

Implementation requirements:
1. When shouldShow becomes true (filters match), hide the Locate button using DOM manipulation
2. Position our Shelf Map button where the Locate button was
3. When the component is destroyed (ngOnDestroy), restore the Locate button visibility
4. Our button should look similar to the Locate button (same size, styling)

Key considerations:
- Use this.elementRef.nativeElement.closest() to traverse to the right parent
- Hide the Locate button by setting display: none
- Handle the case where the Locate button may not be rendered yet (use MutationObserver if needed)

Return a summary of the changes made with file paths.`,
      context: args,
      instructions: [
        'Read the current component implementation',
        'Add hideLocateButton() method',
        'Add showLocateButton() method for cleanup',
        'Call hideLocateButton() when shouldShow becomes true',
        'Call showLocateButton() in ngOnDestroy',
        'Update SCSS for proper button positioning',
        'Make the edits using the Edit tool'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['changes'],
      properties: {
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

// Task 3: Verify the implementation in browser
export const verifyImplementationTask = defineTask('verify-implementation', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify Locate button replacement in browser',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA tester verifying frontend changes',
      task: `Verify that the Locate button replacement works correctly in the browser.

Test scenarios:
1. Navigate to Primo search at http://localhost:4201
2. Search for an item at Sourasky Central Library (configured library) with a call number that has a mapping
3. Verify:
   - The "Locate" button is HIDDEN
   - The "Shelf Map" button appears in its place
   - The Shelf Map button is properly styled and positioned
   - Clicking Shelf Map opens the dialog correctly

4. Search for an item at a different library (NOT configured)
5. Verify:
   - The "Locate" button is VISIBLE (not hidden)
   - The "Shelf Map" button does NOT appear

Use Playwright browser tools to test.

Return verification results.`,
      context: args,
      instructions: [
        'Ensure dev server is running',
        'Use browser_navigate to go to search',
        'Use browser_snapshot to verify button visibility',
        'Test both configured and non-configured locations',
        'Document any issues found'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['verified'],
      properties: {
        verified: { type: 'boolean' },
        configuredLocationTest: { type: 'boolean' },
        nonConfiguredLocationTest: { type: 'boolean' },
        buttonStyling: { type: 'boolean' },
        dialogWorks: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

// Main process function
export async function process(inputs, ctx) {
  const { devServerUrl = 'http://localhost:4201', searchQuery = '296.851' } = inputs;

  // Step 1: Find the Locate button selector
  const findResult = await ctx.task(findLocateButtonTask, {
    devServerUrl,
    searchQuery
  });

  // Breakpoint: Review the findings before implementing
  await ctx.breakpoint({
    question: `Found Locate button with selector: "${findResult.locateButtonSelector}". Proceed with implementation?`,
    title: 'DOM Analysis Complete',
    context: {
      runId: ctx.runId,
      files: []
    }
  });

  // Step 2: Implement the replacement logic
  const implementResult = await ctx.task(implementReplaceLogicTask, {
    locateButtonSelector: findResult.locateButtonSelector,
    parentContainerSelector: findResult.parentContainerSelector,
    buttonStructure: findResult.buttonStructure
  });

  // Step 3: Verify the implementation
  const verifyResult = await ctx.task(verifyImplementationTask, {
    changes: implementResult.changes
  });

  // Handle verification failures with fixes
  if (!verifyResult.verified && verifyResult.issues?.length > 0) {
    await ctx.breakpoint({
      question: `Verification found ${verifyResult.issues.length} issue(s). Review and fix manually, or continue?`,
      title: 'Issues Found',
      context: {
        runId: ctx.runId,
        files: []
      }
    });
  }

  // Final breakpoint
  await ctx.breakpoint({
    question: `Implementation ${verifyResult.verified ? 'verified successfully' : 'completed with issues'}. Approve?`,
    title: 'Final Review',
    context: {
      runId: ctx.runId,
      files: []
    }
  });

  return {
    success: verifyResult.verified,
    findResult,
    implementResult,
    verifyResult,
    metadata: {
      processId: 'replace-locate-button',
      timestamp: ctx.now()
    }
  };
}

export default process;
