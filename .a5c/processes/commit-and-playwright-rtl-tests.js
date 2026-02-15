/**
 * @process commit-and-playwright-rtl-tests
 * @description Commit Hebrew library name fix, then design and implement Playwright tests for RTL directionality
 * @inputs { commitMessage: string, knownIssue: string }
 * @outputs { success: boolean, commitHash: string, testsCreated: string[] }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * Two-phase process:
 * Phase 1: Commit the Hebrew library name mapping fix with documentation
 * Phase 2: Design and implement Playwright tests for RTL directionality verification
 *
 * @param {Object} inputs - Process inputs
 * @param {Object} ctx - Process context
 * @returns {Promise<Object>} Process result
 */
export async function process(inputs, ctx) {
  const {
    knownIssue = 'RTL directionality issue: labels with colons display incorrectly in Hebrew (colon appears at wrong end)'
  } = inputs;

  // ============================================================================
  // PHASE 1: COMMIT THE HEBREW LIBRARY NAME FIX
  // ============================================================================

  const commitResult = await ctx.task(commitFixTask, {
    files: [
      'src/app/custom1-module/cenlib-map/config/google-sheets.config.ts',
      'src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts',
      'src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts'
    ],
    knownIssue
  });

  // Breakpoint: Confirm commit was successful
  await ctx.breakpoint({
    question: `Commit created. Proceed to design Playwright tests for RTL fix?`,
    title: 'Commit Review',
    context: {
      runId: ctx.runId
    }
  });

  // ============================================================================
  // PHASE 2: DESIGN PLAYWRIGHT TESTS FOR RTL DIRECTIONALITY
  // ============================================================================

  // Step 2a: Set up Playwright if not already installed
  const setupResult = await ctx.task(setupPlaywrightTask, {});

  // Step 2b: Design the test cases
  const testDesignResult = await ctx.task(designRtlTestsTask, {
    knownIssue,
    dialogComponent: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.html',
    dialogStyles: 'src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.scss'
  });

  // Breakpoint: Review test design before implementation
  await ctx.breakpoint({
    question: `Test design complete. Review and approve to proceed with implementation?`,
    title: 'Test Design Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: 'artifacts/rtl-test-design.md', format: 'markdown' }
      ]
    }
  });

  // Step 2c: Implement the Playwright tests
  const implementResult = await ctx.task(implementRtlTestsTask, {
    testDesign: testDesignResult,
    knownIssue
  });

  // Step 2d: Run the tests to verify they detect the RTL issue
  const testRunResult = await ctx.task(runPlaywrightTestsTask, {
    testFiles: implementResult.testFiles
  });

  // Final breakpoint
  await ctx.breakpoint({
    question: `Playwright tests created and executed. Tests should fail on RTL issue (expected). Ready to complete?`,
    title: 'Final Review',
    context: {
      runId: ctx.runId
    }
  });

  return {
    success: true,
    commitHash: commitResult.commitHash,
    testsCreated: implementResult.testFiles,
    testRunResult,
    metadata: {
      processId: 'commit-and-playwright-rtl-tests',
      timestamp: ctx.now()
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

/**
 * Commit the Hebrew library name fix
 */
export const commitFixTask = defineTask('commit-fix', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Commit Hebrew library name mapping fix',
  description: 'Stage and commit the Hebrew library name support changes',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Git expert',
      task: 'Commit the Hebrew library name mapping fix with proper commit message',
      context: {
        files: args.files,
        knownIssue: args.knownIssue
      },
      instructions: [
        'Stage the specified files using git add',
        'Create a commit with a descriptive message that includes:',
        '  - feat(cenlib-map): Add Hebrew library name support for mapping index',
        '  - Describe what was changed (libraryNameHe field, dual-language indexing)',
        '  - Note the known issue with RTL directionality in the commit body',
        '  - Add Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>',
        'Return the commit hash'
      ],
      outputFormat: 'JSON with commitHash (string), success (boolean)'
    },
    outputSchema: {
      type: 'object',
      required: ['commitHash', 'success'],
      properties: {
        commitHash: { type: 'string' },
        success: { type: 'boolean' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['git', 'commit']
}));

/**
 * Set up Playwright
 */
export const setupPlaywrightTask = defineTask('setup-playwright', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Set up Playwright for E2E testing',
  description: 'Install and configure Playwright if not already set up',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'DevOps engineer',
      task: 'Set up Playwright for E2E testing in the Angular project',
      context: {},
      instructions: [
        'Check if Playwright is already installed (look for @playwright/test in package.json)',
        'If not installed, install Playwright: npm install -D @playwright/test',
        'Install browsers if needed: npx playwright install chromium',
        'Create playwright.config.ts if it does not exist with basic configuration',
        'Create e2e directory structure if needed',
        'Return setup status'
      ],
      outputFormat: 'JSON with installed (boolean), configCreated (boolean), browsersInstalled (boolean)'
    },
    outputSchema: {
      type: 'object',
      required: ['installed'],
      properties: {
        installed: { type: 'boolean' },
        configCreated: { type: 'boolean' },
        browsersInstalled: { type: 'boolean' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['setup', 'playwright']
}));

/**
 * Design RTL tests
 */
export const designRtlTestsTask = defineTask('design-rtl-tests', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Design Playwright tests for RTL directionality',
  description: 'Create test design document for RTL verification',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA Test Architect',
      task: 'Design comprehensive Playwright tests for verifying RTL directionality in the cenlib-map dialog',
      context: {
        knownIssue: args.knownIssue,
        dialogComponent: args.dialogComponent,
        dialogStyles: args.dialogStyles
      },
      instructions: [
        'Read the dialog component HTML and SCSS files',
        'Identify all text elements that need RTL verification (labels with colons, values, title)',
        'Design test cases that verify:',
        '  1. Dialog opens correctly in Hebrew mode (?lang=he)',
        '  2. Labels display with correct RTL direction (colon at end in visual order)',
        '  3. Text alignment is correct for Hebrew',
        '  4. Compare with English mode to ensure both work',
        'Use Playwright selectors and assertions',
        'Consider using visual comparison or computed style checks',
        'Document the expected behavior vs current (broken) behavior',
        'Return the test design as structured JSON'
      ],
      outputFormat: 'JSON with testCases (array), selectors (object), expectedBehavior (object)'
    },
    outputSchema: {
      type: 'object',
      required: ['testCases'],
      properties: {
        testCases: { type: 'array', items: { type: 'object' } },
        selectors: { type: 'object' },
        expectedBehavior: { type: 'object' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['design', 'testing', 'rtl']
}));

/**
 * Implement RTL tests
 */
export const implementRtlTestsTask = defineTask('implement-rtl-tests', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Implement Playwright RTL tests',
  description: 'Write the actual Playwright test files',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Playwright Test Developer',
      task: 'Implement the designed Playwright tests for RTL directionality verification',
      context: {
        testDesign: args.testDesign,
        knownIssue: args.knownIssue
      },
      instructions: [
        'Create e2e/cenlib-map-rtl.spec.ts with the test cases from the design',
        'Use Playwright test syntax with proper describe/test blocks',
        'Implement helper functions for common operations (open dialog, switch language)',
        'Add assertions that check computed CSS direction property',
        'Add visual assertions for text alignment',
        'Include comments explaining what each test verifies',
        'The tests should FAIL on the current code (to verify they detect the RTL issue)',
        'Return the list of created test files'
      ],
      outputFormat: 'JSON with testFiles (array of file paths), success (boolean)'
    },
    outputSchema: {
      type: 'object',
      required: ['testFiles', 'success'],
      properties: {
        testFiles: { type: 'array', items: { type: 'string' } },
        success: { type: 'boolean' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'testing', 'playwright']
}));

/**
 * Run Playwright tests
 */
export const runPlaywrightTestsTask = defineTask('run-playwright-tests', (args, taskCtx) => ({
  kind: 'shell',
  title: 'Run Playwright RTL tests',
  description: 'Execute the Playwright tests to verify they detect the RTL issue',

  shell: {
    command: 'cd /home/hagaybar/projects/TAU_customModule && npx playwright test e2e/cenlib-map-rtl.spec.ts --reporter=list 2>&1 | head -100'
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['testing', 'execution']
}));
