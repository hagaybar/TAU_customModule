/**
 * @process add-map-pan-drag
 * @description Add pan/drag functionality to the shelf map SVG component when zoomed in
 * @inputs { feature: string, requirements: array }
 * @outputs { success: boolean, summary: string }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

// Task: Implement pan/drag functionality
const implementPanDragTask = defineTask('implement-pan-drag', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Implement pan/drag functionality',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular frontend developer implementing pan/drag feature',
      task: `Implement pan/drag functionality for the shelf-map-svg component.

Current state:
- The component already has zoom functionality (zoomLevel, zoomIn, zoomOut, resetZoom)
- CSS has cursor: grab and cursor: grabbing styles when zoomed
- But there's NO actual drag/pan functionality - just the visual cursor

Requirements:
1. When zoomed in (zoomLevel > 1), user should be able to click and drag to pan the map
2. Support both mouse (mousedown/mousemove/mouseup) and touch (touchstart/touchmove/touchend)
3. Pan should work smoothly with proper cursor feedback
4. Pan position should reset when zoom is reset

Files to modify:
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.ts
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.html
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.scss (if needed)

Implementation approach:
1. Add pan state properties: isPanning, panStartX, panStartY, panOffsetX, panOffsetY
2. Add event handlers for mouse/touch events on .map-viewport
3. Track drag delta and update panOffset
4. Apply translate transform along with scale transform
5. Reset pan offset when resetZoom() is called

Return a JSON summary of changes made.`,
      context: args,
      instructions: [
        'Read the current component files first',
        'Add pan state properties to the component class',
        'Add mouse and touch event handlers',
        'Update the template to bind events to .map-viewport',
        'Update the transform style to include translate for pan',
        'Reset pan when zoom resets',
        'Make sure to clean up event listeners in ngOnDestroy'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['implemented'],
      properties: {
        implemented: { type: 'boolean' },
        changes: { type: 'array', items: { type: 'object' } },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

// Task: Verify the implementation
const verifyPanDragTask = defineTask('verify-pan-drag', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify pan/drag works in browser',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA tester verifying frontend feature',
      task: `Verify that the pan/drag functionality works correctly in the shelf map component.

Test steps:
1. Navigate to the Primo search at localhost:4201
2. Search for a book with physical availability
3. Find a result with "Available" status
4. Click to expand availability details
5. Click the "Shelf Map" button
6. In the map dialog:
   a. Verify the map loads with zoom controls
   b. Click "Zoom in" button one or more times
   c. Try to click and drag the map - it should pan/move
   d. Verify the cursor changes to grabbing while dragging
   e. Click "Full map" to reset and verify pan resets too

Use Playwright browser tools to test.

Return verification results.`,
      context: args,
      instructions: [
        'Use browser_navigate to go to localhost:4201',
        'Use browser_snapshot to see the page state',
        'Search for a book and find one with availability',
        'Navigate to the shelf map dialog',
        'Test zoom and pan functionality',
        'Document any issues found'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['verified'],
      properties: {
        verified: { type: 'boolean' },
        zoomWorks: { type: 'boolean' },
        panWorks: { type: 'boolean' },
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

// Task: Fix any issues
const fixIssuesTask = defineTask('fix-issues', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Fix issues found during verification',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular frontend developer fixing issues',
      task: `Fix the issues found during verification of the pan/drag feature.

Issues reported:
${JSON.stringify(args.issues || [], null, 2)}

Files to check/modify:
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.ts
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.html
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.scss

Fix the reported issues and return a summary of changes.`,
      context: args,
      instructions: [
        'Read the current implementation',
        'Identify the root cause of each issue',
        'Make targeted fixes',
        'Return summary of fixes applied'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['fixed'],
      properties: {
        fixed: { type: 'boolean' },
        changes: { type: 'array', items: { type: 'object' } },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

/**
 * Main process function
 */
export async function process(inputs, ctx) {
  const { feature, requirements } = inputs;

  // Step 1: Implement pan/drag functionality
  const implementResult = await ctx.task(implementPanDragTask, {
    feature,
    requirements,
    componentPath: 'src/app/custom1-module/cenlib-map/shelf-map-svg/'
  });

  if (!implementResult.implemented) {
    return {
      success: false,
      summary: 'Failed to implement pan/drag functionality',
      error: implementResult
    };
  }

  // Step 2: Verify in browser
  const verifyResult = await ctx.task(verifyPanDragTask, {
    implementation: implementResult
  });

  // Step 3: Fix issues if any
  if (!verifyResult.verified && verifyResult.issues && verifyResult.issues.length > 0) {
    const fixResult = await ctx.task(fixIssuesTask, {
      issues: verifyResult.issues,
      implementation: implementResult
    });

    return {
      success: fixResult.fixed,
      summary: fixResult.summary || 'Fixed issues from verification',
      implementation: implementResult,
      verification: verifyResult,
      fixes: fixResult
    };
  }

  return {
    success: verifyResult.verified,
    summary: verifyResult.summary || 'Pan/drag functionality implemented and verified',
    implementation: implementResult,
    verification: verifyResult
  };
}

export default process;
