/**
 * @process cenlib-map-multi-shelf-dialog
 * @description Enhance cenlib-map dialog to display all matching shelf locations (multiple shelves)
 * @inputs { targetFiles: string[], requirements: object }
 * @outputs { success: boolean, filesModified: string[], testResults: object }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * Multi-Shelf Dialog Enhancement Process
 *
 * Enhances the cenlib-map dialog component to display multiple shelf locations
 * when a call number spans across multiple shelves.
 *
 * Requirements:
 * - Display comma-separated list with intro text: "הפריט נמצא באחד מהמדפים הללו:" (Hebrew)
 * - Show all unique floors
 * - De-duplicate shelf labels (unique only)
 * - SVG highlighting already works (no changes needed)
 *
 * @param {Object} inputs - Process inputs
 * @param {Object} ctx - Process context
 * @returns {Promise<Object>} Process result
 */
export async function process(inputs, ctx) {
  const targetFiles = {
    dialogComponent: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.ts',
    dialogTemplate: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.html',
    dialogStyles: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.scss',
  };

  const requirements = {
    multiShelfText: {
      en: 'The item should be in one of these shelves:',
      he: 'הפריט נמצא באחד מהמדפים הללו:'
    },
    deduplicateShelves: true,
    showAllFloors: true,
    commaSeparatedList: true
  };

  // ============================================================================
  // PHASE 1: IMPLEMENTATION
  // ============================================================================

  const implementResult = await ctx.task(implementMultiShelfTask, {
    targetFiles,
    requirements
  });

  // ============================================================================
  // PHASE 2: VERIFICATION
  // ============================================================================

  // Breakpoint: Review implementation before final verification
  await ctx.breakpoint({
    question: 'Implementation complete. Please review the changes and verify they meet the requirements. Approve to proceed to final verification?',
    title: 'Multi-Shelf Dialog Implementation Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: targetFiles.dialogComponent, format: 'code', language: 'typescript' },
        { path: targetFiles.dialogTemplate, format: 'code', language: 'html' }
      ]
    }
  });

  const verifyResult = await ctx.task(verifyImplementationTask, {
    targetFiles,
    requirements,
    implementResult
  });

  // ============================================================================
  // PHASE 3: FINAL REVIEW
  // ============================================================================

  // Final breakpoint for approval
  await ctx.breakpoint({
    question: `Verification complete. All changes tested successfully. Approve as complete?`,
    title: 'Final Multi-Shelf Enhancement Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: targetFiles.dialogComponent, format: 'code', language: 'typescript' },
        { path: targetFiles.dialogTemplate, format: 'code', language: 'html' }
      ]
    }
  });

  return {
    success: true,
    filesModified: Object.values(targetFiles),
    implementResult,
    verifyResult,
    metadata: {
      processId: 'cenlib-map-multi-shelf-dialog',
      timestamp: ctx.now()
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

/**
 * Implement multi-shelf display functionality
 */
export const implementMultiShelfTask = defineTask('implement-multi-shelf', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Implement multi-shelf dialog display',
  description: 'Modify dialog component to show all matching shelf locations',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular developer specializing in TypeScript and Angular Material',
      task: 'Modify the cenlib-map dialog component to display all matching shelf locations (not just the first)',
      context: {
        targetFiles: args.targetFiles,
        requirements: args.requirements,
        currentBehavior: 'Dialog only shows primaryMapping (first match)',
        desiredBehavior: 'Show comma-separated list of all unique shelves with intro text'
      },
      instructions: [
        '1. Read the existing dialog component files to understand the current structure',
        '2. In the TypeScript component, add new methods:',
        '   - getMultipleShelfLabels(): returns comma-separated unique shelf labels',
        '   - getMultipleFloors(): returns comma-separated unique floors',
        '   - getMultipleSectionDescriptions(): returns comma-separated sections (unique)',
        '   - get multiShelfIntroText(): returns bilingual intro text based on currentLanguage',
        '   - get hasMultipleMappings(): returns true if mappings.length > 1',
        '3. In the HTML template:',
        '   - When hasMultipleMappings is true, show the multi-shelf intro text + comma-separated shelf labels',
        '   - When there is only one mapping, keep the existing display (single shelf)',
        '   - Show all unique floors (comma-separated)',
        '4. Ensure Hebrew/English language support works correctly',
        '5. De-duplicate shelf labels and floors (use unique values only)',
        '6. The SVG highlighting already handles multiple shelves - do not change that',
        '7. Keep existing styling patterns - add minimal new CSS if needed',
        'Return summary of changes made including files modified and key functions added'
      ],
      outputFormat: 'JSON with filesModified (array), functionsAdded (array), templateChanges (string), summary (string)'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified', 'functionsAdded', 'summary'],
      properties: {
        filesModified: { type: 'array', items: { type: 'string' } },
        functionsAdded: { type: 'array', items: { type: 'string' } },
        templateChanges: { type: 'string' },
        summary: { type: 'string' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'angular', 'multi-shelf']
}));

/**
 * Verify implementation correctness
 */
export const verifyImplementationTask = defineTask('verify-implementation', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify multi-shelf implementation',
  description: 'Verify the implementation meets all requirements',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA engineer and code reviewer',
      task: 'Verify the multi-shelf dialog implementation is correct and complete',
      context: {
        targetFiles: args.targetFiles,
        requirements: args.requirements,
        implementResult: args.implementResult
      },
      instructions: [
        '1. Read the modified files to verify implementation',
        '2. Check that all required methods were added',
        '3. Verify de-duplication logic is correct',
        '4. Verify Hebrew/English bilingual support works',
        '5. Check template correctly switches between single/multi shelf display',
        '6. Verify the intro text matches requirements:',
        '   - English: "The item should be in one of these shelves:"',
        '   - Hebrew: "הפריט נמצא באחד מהמדפים הללו:"',
        '7. Check no TypeScript compilation errors',
        '8. Verify SVG highlighting was NOT modified (should remain as-is)',
        'Return verification results with any issues found'
      ],
      outputFormat: 'JSON with passed (boolean), checks (array of check results), issues (array), recommendations (array)'
    },
    outputSchema: {
      type: 'object',
      required: ['passed', 'checks'],
      properties: {
        passed: { type: 'boolean' },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              passed: { type: 'boolean' },
              details: { type: 'string' }
            }
          }
        },
        issues: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['verification', 'qa']
}));
