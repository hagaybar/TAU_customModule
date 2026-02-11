/**
 * Process: Fix CenLib Map Issues
 *
 * Two issues to fix:
 * 1. Map window is too small - enlarge by 20%
 * 2. Location markers not appearing on SVG - svgCodes in CSV don't match element IDs in SVG
 */
import pkg from '@a5c-ai/babysitter-sdk';
const { defineProcess, defineTask } = pkg;

// Task 1: Analyze the current state and identify exact fixes needed
export const analyzeIssues = defineTask('analyze-issues', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Analyze map size and marker issues',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Frontend developer analyzing Angular component issues',
      task: `Analyze the cenlib-map component to identify exact fixes needed for:
1. Map dialog/container size - it needs to be enlarged by ~20%
2. SVG marker highlighting - svgCodes from CSV don't match SVG element IDs

Files to analyze:
- src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.scss
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.scss
- src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.ts
- docs/features/map_cenlib_shelves/validation/mismatch-report.md

Return a JSON object with:
{
  "sizeChanges": [
    { "file": "path", "currentValue": "value", "newValue": "value", "selector": "css selector" }
  ],
  "markerIssue": {
    "rootCause": "description of why markers don't appear",
    "fixApproach": "description of fix approach",
    "affectedFiles": ["list of files to modify"]
  }
}`,
      context: args,
      instructions: [
        'Read the SCSS files to find current size values',
        'Read the mismatch report to understand the svgCode vs SVG ID issue',
        'Identify all CSS properties that control dialog/map size',
        'Determine whether to fix CSV codes or add flexible matching logic',
        'Return structured analysis as JSON'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['sizeChanges', 'markerIssue'],
      properties: {
        sizeChanges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              currentValue: { type: 'string' },
              newValue: { type: 'string' },
              selector: { type: 'string' }
            }
          }
        },
        markerIssue: {
          type: 'object',
          properties: {
            rootCause: { type: 'string' },
            fixApproach: { type: 'string' },
            affectedFiles: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

// Task 2: Fix the map size (enlarge by 20%)
export const fixMapSize = defineTask('fix-map-size', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Enlarge map dialog by 20%',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Frontend developer making CSS changes',
      task: `Modify the cenlib-map component SCSS to enlarge the map dialog by approximately 20%.

Based on the analysis, make these changes:
${JSON.stringify(args.sizeChanges, null, 2)}

Key areas to modify:
1. Dialog max-width/width
2. .external-svg-container max-height
3. Any fixed pixel values that constrain the map size

Return a summary of changes made with file paths and line numbers.`,
      context: args,
      instructions: [
        'Read each SCSS file',
        'Make targeted edits to increase sizes by ~20%',
        'Preserve existing styles and only modify size-related values',
        'Test that changes are valid SCSS syntax'
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
              description: { type: 'string' },
              oldValue: { type: 'string' },
              newValue: { type: 'string' }
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

// Task 3: Fix the marker highlighting issue
export const fixMarkerHighlighting = defineTask('fix-marker-highlighting', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Fix SVG marker highlighting',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Frontend developer fixing SVG element selection',
      task: `Fix the SVG marker highlighting issue in the shelf-map-svg component.

Root cause: ${args.markerIssue?.rootCause || 'svgCodes in CSV do not match element IDs in SVG'}
Fix approach: ${args.markerIssue?.fixApproach || 'Add flexible matching or normalize codes'}

The current code in shelf-map-svg.component.ts:
- Queries elements using: container.querySelector(\`#\${code}\`)
- But the svgCodes from CSV (e.g., "ka1_18_b") may not exactly match SVG element IDs

Options:
1. Add fallback matching (try variations like without prefix number)
2. Update the applyHighlighting method to be more flexible
3. Log what IDs actually exist in the SVG for debugging

Implement the fix and return a summary of changes.`,
      context: args,
      instructions: [
        'Read the shelf-map-svg.component.ts file',
        'Modify the applyHighlighting method to handle mismatched IDs',
        'Add logging to show available shelf IDs vs requested codes',
        'Consider adding a normalization function for codes',
        'Test the logic is correct'
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

// Task 4: Verify fixes in browser
export const verifyFixes = defineTask('verify-fixes', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify fixes in browser',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA tester verifying frontend fixes',
      task: `Verify that the cenlib-map fixes work correctly:

1. Navigate to the Primo search at localhost:4201
2. Search for a book with physical availability
3. Click "Available" to see location details
4. Click "Shelf Map" button
5. Verify:
   - Dialog is larger than before (approximately 20% bigger)
   - SVG floor map is visible
   - Shelf marker is highlighted (red) on the map
   - Location details are displayed correctly

Use Playwright browser tools to test.

Return verification results with screenshots if possible.`,
      context: args,
      instructions: [
        'Use browser_navigate to go to search',
        'Use browser_snapshot to capture state',
        'Use browser_click to interact with elements',
        'Check console for any errors',
        'Verify visual elements are correct'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['verified'],
      properties: {
        verified: { type: 'boolean' },
        sizeVerified: { type: 'boolean' },
        markerVerified: { type: 'boolean' },
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

// Main process definition
export const fixCenlibMapProcess = defineProcess('fix-cenlib-map', {
  title: 'Fix CenLib Map Issues',
  description: 'Fix map window size and marker highlighting in cenlib-map component',

  steps: [
    {
      id: 'analyze',
      task: analyzeIssues,
      inputs: {
        issue1: 'Map window is too small - needs ~20% enlargement',
        issue2: 'Location markers not appearing on SVG floor maps',
        proxyRunning: true,
        port: 4201
      }
    },
    {
      id: 'fix-size',
      task: fixMapSize,
      dependsOn: ['analyze'],
      inputs: (results) => ({
        sizeChanges: results.analyze?.sizeChanges || []
      })
    },
    {
      id: 'fix-markers',
      task: fixMarkerHighlighting,
      dependsOn: ['analyze'],
      inputs: (results) => ({
        markerIssue: results.analyze?.markerIssue || {}
      })
    },
    {
      id: 'verify',
      task: verifyFixes,
      dependsOn: ['fix-size', 'fix-markers'],
      inputs: (results) => ({
        sizeChanges: results['fix-size']?.changes || [],
        markerChanges: results['fix-markers']?.changes || []
      })
    }
  ]
});

export default fixCenlibMapProcess;
