/**
 * @process bidi-dialog-test
 * @description Test Hebrew and English BiDi text display in cenlib-map dialog using Playwright screenshots
 * @inputs { dialogUrl: string, searchQuery: string }
 * @outputs { success: boolean, analysisReport: object, screenshotPaths: string[] }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * BiDi Dialog Test Process
 *
 * Uses the bidi-engineering skill and Playwright to verify that:
 * 1. Hebrew text displays correctly (RTL direction, proper colon placement)
 * 2. English text displays correctly (LTR direction)
 * 3. Mixed content (numbers, punctuation) handles bidirectionality properly
 * 4. Both Hebrew and English readers are satisfied with the layout
 *
 * @param {Object} inputs - Process inputs
 * @param {Object} ctx - Process context
 * @returns {Promise<Object>} Process result
 */
export async function process(inputs, ctx) {
  const {
    dialogUrl = 'http://localhost:4201/discovery/search?vid=972TAU_INST:NDE_TEST',
    searchQuery = 'test'
  } = inputs;

  // ============================================================================
  // PHASE 1: ANALYZE DIALOG COMPONENT FOR BIDI ISSUES
  // ============================================================================

  const analysisResult = await ctx.task(analyzeBidiTask, {
    componentFiles: {
      html: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.html',
      scss: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.scss',
      ts: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.ts'
    }
  });

  // ============================================================================
  // PHASE 2: TAKE SCREENSHOTS IN BOTH LANGUAGES
  // ============================================================================

  const screenshotResult = await ctx.task(takeScreenshotsTask, {
    dialogUrl,
    searchQuery
  });

  // ============================================================================
  // PHASE 3: ANALYZE SCREENSHOTS AND VERIFY BIDI CORRECTNESS
  // ============================================================================

  const verificationResult = await ctx.task(verifyBidiTask, {
    screenshotPaths: screenshotResult.screenshotPaths,
    analysisResult: analysisResult
  });

  // ============================================================================
  // PHASE 4: USER REVIEW - BREAKPOINT
  // ============================================================================

  await ctx.breakpoint({
    question: `BiDi analysis complete. Please review the screenshots and analysis. Are both Hebrew and English displays satisfactory?`,
    title: 'BiDi Verification Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: screenshotResult.screenshotPaths[0] || 'e2e/screenshots/dialog-hebrew.png', format: 'png', label: 'Hebrew Dialog' },
        { path: screenshotResult.screenshotPaths[1] || 'e2e/screenshots/dialog-english.png', format: 'png', label: 'English Dialog' }
      ]
    }
  });

  // ============================================================================
  // PHASE 5: APPLY FIXES IF NEEDED
  // ============================================================================

  if (!verificationResult.hebrewSatisfactory || !verificationResult.englishSatisfactory) {
    const fixResult = await ctx.task(applyBidiFixesTask, {
      issues: verificationResult.issues,
      componentFiles: {
        html: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.html',
        scss: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.scss'
      }
    });

    // Re-take screenshots after fixes
    const postFixScreenshots = await ctx.task(takeScreenshotsTask, {
      dialogUrl,
      searchQuery
    });

    // Final verification breakpoint
    await ctx.breakpoint({
      question: `BiDi fixes applied. Please review the updated screenshots. Are both Hebrew and English displays now satisfactory?`,
      title: 'Post-Fix BiDi Verification',
      context: {
        runId: ctx.runId,
        files: [
          { path: postFixScreenshots.screenshotPaths[0] || 'e2e/screenshots/dialog-hebrew.png', format: 'png', label: 'Hebrew Dialog (Fixed)' },
          { path: postFixScreenshots.screenshotPaths[1] || 'e2e/screenshots/dialog-english.png', format: 'png', label: 'English Dialog (Fixed)' }
        ]
      }
    });
  }

  return {
    success: true,
    analysisReport: analysisResult,
    verificationResult,
    screenshotPaths: screenshotResult.screenshotPaths,
    metadata: {
      processId: 'bidi-dialog-test',
      timestamp: ctx.now()
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

/**
 * Analyze dialog component for BiDi issues using bidi-engineering skill
 */
export const analyzeBidiTask = defineTask('analyze-bidi', (args, taskCtx) => ({
  kind: 'skill',
  title: 'Analyze dialog for BiDi issues',
  description: 'Use bidi-engineering skill to analyze the dialog component for RTL/BiDi issues',

  skill: {
    name: 'bidi-engineering',
    context: {
      task: 'Analyze the cenlib-map dialog component for BiDi (bidirectional text) issues',
      componentFiles: args.componentFiles,
      checkPoints: [
        'Verify CSS uses logical properties (margin-inline-start/end) instead of physical (margin-left/right)',
        'Check for proper dir="rtl" attribute application in Hebrew mode',
        'Verify dynamic content is wrapped with <bdi> tags where needed',
        'Check that form inputs (if any) have proper dir="ltr" for LTR-native data',
        'Verify labels with colons display correctly in both directions',
        'Check icon mirroring decisions are correct'
      ],
      instructions: [
        'Read the HTML, SCSS, and TS component files',
        'Apply BiDi engineering principles to identify issues',
        'Test with torture strings: "בדיקה 123-456 בדיקה" and "בדיקה English."',
        'Report issues and recommendations',
        'Return structured analysis in JSON format'
      ]
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['bidi', 'analysis', 'rtl']
}));

/**
 * Take screenshots of dialog in both Hebrew and English
 */
export const takeScreenshotsTask = defineTask('take-screenshots', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Take dialog screenshots in both languages',
  description: 'Use Playwright to capture dialog in Hebrew and English modes',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'E2E Test Automation Engineer',
      task: 'Use Playwright MCP tools to take screenshots of the cenlib-map dialog in both Hebrew and English modes',
      context: {
        dialogUrl: args.dialogUrl,
        searchQuery: args.searchQuery
      },
      instructions: [
        'Use browser_navigate to go to the Primo search page with lang=he for Hebrew',
        'Wait for the page to load fully',
        'Search for a book that has shelf mapping data or navigate to a known record',
        'Click on "מפת מדף" (Shelf Map) button to open the dialog',
        'Use browser_take_screenshot to capture the Hebrew dialog and save to e2e/screenshots/dialog-hebrew.png',
        'Close the dialog and navigate to lang=en for English',
        'Open the dialog again',
        'Use browser_take_screenshot to capture the English dialog and save to e2e/screenshots/dialog-english.png',
        'Verify screenshots were taken successfully',
        'Return the paths to the screenshots'
      ],
      outputFormat: 'JSON with screenshotPaths (array of strings), success (boolean)'
    },
    outputSchema: {
      type: 'object',
      required: ['screenshotPaths', 'success'],
      properties: {
        screenshotPaths: { type: 'array', items: { type: 'string' } },
        success: { type: 'boolean' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['screenshots', 'playwright', 'e2e']
}));

/**
 * Verify BiDi correctness from screenshots and analysis
 */
export const verifyBidiTask = defineTask('verify-bidi', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify BiDi correctness',
  description: 'Review screenshots and analysis to verify BiDi implementation',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'BiDi/RTL Expert QA Engineer',
      task: 'Verify that the dialog displays correctly for both Hebrew and English readers',
      context: {
        screenshotPaths: args.screenshotPaths,
        analysisResult: args.analysisResult
      },
      instructions: [
        'Read the Hebrew screenshot using the Read tool (it supports images)',
        'Read the English screenshot using the Read tool',
        'Apply bidi-engineering principles to verify correctness:',
        '  - Hebrew: Labels with colons (ספרייה:, אוסף:) should have colon at the visual END (left side)',
        '  - Hebrew: Text should flow right-to-left',
        '  - Hebrew: Values should appear to the RIGHT of labels',
        '  - English: Labels should be left-aligned',
        '  - English: Values should appear to the RIGHT of labels',
        '  - Both: Numbers and punctuation should display correctly',
        'Verify torture strings if visible: numbers should not flip, periods should stay in place',
        'Document any issues found',
        'Return verification results with hebrewSatisfactory, englishSatisfactory, and issues array'
      ],
      outputFormat: 'JSON with hebrewSatisfactory (boolean), englishSatisfactory (boolean), issues (array)'
    },
    outputSchema: {
      type: 'object',
      required: ['hebrewSatisfactory', 'englishSatisfactory'],
      properties: {
        hebrewSatisfactory: { type: 'boolean' },
        englishSatisfactory: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'object' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['verification', 'bidi', 'qa']
}));

/**
 * Apply BiDi fixes if needed
 */
export const applyBidiFixesTask = defineTask('apply-bidi-fixes', (args, taskCtx) => ({
  kind: 'skill',
  title: 'Apply BiDi fixes to dialog component',
  description: 'Use bidi-engineering skill to fix identified BiDi issues',

  skill: {
    name: 'bidi-engineering',
    context: {
      task: 'Fix the identified BiDi issues in the cenlib-map dialog component',
      issues: args.issues,
      componentFiles: args.componentFiles,
      instructions: [
        'Read the component files',
        'Apply fixes for each identified issue following BiDi engineering principles:',
        '  - Use CSS logical properties (margin-inline-start/end)',
        '  - Add proper dir attributes where needed',
        '  - Wrap dynamic content in <bdi> tags',
        '  - Ensure proper text alignment with text-align: start/end',
        '  - Fix any icon mirroring issues',
        'Test that changes work for both Hebrew and English',
        'Return the fixes applied'
      ]
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['bidi', 'fix', 'implementation']
}));
