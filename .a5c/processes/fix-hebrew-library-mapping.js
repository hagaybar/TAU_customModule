/**
 * @process fix-hebrew-library-mapping
 * @description Fix cenlib-map mapping service to support Hebrew library names from CSV
 * @inputs { issueDescription: string, libraryNameHe: string }
 * @outputs { success: boolean, filesModified: string[], summary: string }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * Bug Fix Process: Hebrew Library Name Mapping Support
 *
 * Problem: The CenLib Map button doesn't appear when UI language is Hebrew
 * Root Cause: The mapping index is built using only English library names,
 *             but DOM contains Hebrew names when UI is in Hebrew
 *
 * Solution:
 * 1. Add libraryNameHe column to CSV (already done in Google Sheets)
 * 2. Update CsvRow interface to include libraryNameHe
 * 3. Update parseCsv() to parse libraryNameHe field
 * 4. Update buildMappingIndex() to index by BOTH English and Hebrew library names
 * 5. Update Google Sheets config to use direct published URL
 *
 * @param {Object} inputs - Process inputs
 * @param {string} inputs.issueDescription - Description of the issue
 * @param {string} inputs.libraryNameHe - Hebrew library name
 * @param {Object} ctx - Process context
 * @returns {Promise<Object>} Process result
 */
export async function process(inputs, ctx) {
  const {
    issueDescription = 'CenLib Map button not showing when UI language is Hebrew',
    libraryNameHe = 'הספרייה המרכזית סוראסקי'
  } = inputs;

  // ============================================================================
  // PHASE 1: ANALYZE CURRENT CODE
  // ============================================================================

  const analysisResult = await ctx.task(analyzeCodeTask, {
    targetFiles: [
      'src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts',
      'src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts',
      'src/app/custom1-module/cenlib-map/config/google-sheets.config.ts'
    ],
    issueDescription
  });

  // ============================================================================
  // PHASE 2: IMPLEMENT FIX
  // ============================================================================

  const implementationResult = await ctx.task(implementFixTask, {
    analysis: analysisResult,
    libraryNameHe,
    changes: [
      {
        file: 'shelf-mapping.service.ts',
        description: 'Add libraryNameHe to CsvRow interface and parseCsv()'
      },
      {
        file: 'shelf-mapping.service.ts',
        description: 'Update buildMappingIndex() to index by both English and Hebrew library names'
      },
      {
        file: 'shelf-mapping.config.ts',
        description: 'Add libraryNameHe field to ShelfMapping interface'
      },
      {
        file: 'google-sheets.config.ts',
        description: 'Update URL to use direct Google Sheets published CSV URL'
      }
    ]
  });

  // ============================================================================
  // PHASE 3: VERIFY CHANGES
  // ============================================================================

  // Type check the changes
  const typeCheckResult = await ctx.task(typeCheckTask, {
    files: implementationResult.filesModified
  });

  // Breakpoint: Review changes before proceeding
  await ctx.breakpoint({
    question: `Implementation complete. Modified ${implementationResult.filesModified.length} files. Proceed with verification?`,
    title: 'Implementation Review',
    context: {
      runId: ctx.runId,
      files: implementationResult.filesModified.map(f => ({ path: f, format: 'code', language: 'typescript' }))
    }
  });

  // ============================================================================
  // PHASE 4: FINAL VERIFICATION
  // ============================================================================

  const verificationResult = await ctx.task(verifyFixTask, {
    issueDescription,
    libraryNameHe,
    filesModified: implementationResult.filesModified
  });

  // Final breakpoint for approval
  await ctx.breakpoint({
    question: `Fix verified. All type checks passed. Ready to commit changes?`,
    title: 'Final Approval',
    context: {
      runId: ctx.runId,
      files: [
        { path: 'artifacts/fix-summary.md', format: 'markdown' }
      ]
    }
  });

  // Return results
  return {
    success: true,
    issueDescription,
    filesModified: implementationResult.filesModified,
    summary: `Fixed Hebrew library name mapping. Updated ${implementationResult.filesModified.length} files to support libraryNameHe field in CSV and dual-language indexing.`,
    verification: verificationResult,
    metadata: {
      processId: 'fix-hebrew-library-mapping',
      timestamp: ctx.now()
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

/**
 * Analyze current code task
 */
export const analyzeCodeTask = defineTask('analyze-code', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Analyze current code for mapping issue',
  description: 'Analyze the shelf-mapping service to understand current implementation',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'senior TypeScript developer',
      task: 'Analyze the current shelf-mapping service code to understand how it handles library name lookups',
      context: {
        targetFiles: args.targetFiles,
        issueDescription: args.issueDescription
      },
      instructions: [
        'Read the shelf-mapping.service.ts file',
        'Identify the CsvRow interface and its fields',
        'Identify how buildMappingIndex() builds the mapping index',
        'Identify where library names are used as keys',
        'Confirm that only English library names are currently indexed',
        'Return the analysis summary and specific code locations that need modification'
      ],
      outputFormat: 'JSON with currentState (object), codeLocations (array), analysisComplete (boolean)'
    },
    outputSchema: {
      type: 'object',
      required: ['currentState', 'codeLocations', 'analysisComplete'],
      properties: {
        currentState: { type: 'object' },
        codeLocations: { type: 'array', items: { type: 'string' } },
        analysisComplete: { type: 'boolean' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['analysis', 'code-review']
}));

/**
 * Implement fix task
 */
export const implementFixTask = defineTask('implement-fix', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Implement the Hebrew library name fix',
  description: 'Modify code to support Hebrew library names in mapping index',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'senior TypeScript developer',
      task: 'Implement the fix for Hebrew library name support in the cenlib-map feature',
      context: {
        analysis: args.analysis,
        libraryNameHe: args.libraryNameHe,
        changes: args.changes
      },
      instructions: [
        'Add libraryNameHe field to CsvRow interface in shelf-mapping.service.ts',
        'Update parseCsv() to parse and include libraryNameHe from CSV',
        'Add libraryNameHe field to ShelfMapping interface in shelf-mapping.config.ts',
        'Update buildMappingIndex() to create index entries for BOTH English (libraryName) and Hebrew (libraryNameHe) library names pointing to the same mappings',
        'Update google-sheets.config.ts to use the direct Google Sheets published CSV URL: https://docs.google.com/spreadsheets/d/e/2PACX-1vTE9A3GC_l4_kjAjy2c6Cc_woDgJCEctZSo0dY2zN-UMgziokuWLqZwSznQtaAHa5v7g7K_tkjMVhXY/pub?output=csv',
        'Ensure the code handles the case when libraryNameHe is empty or missing',
        'Return the list of files modified'
      ],
      outputFormat: 'JSON with filesModified (array of file paths), changesDescription (string), success (boolean)'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified', 'success'],
      properties: {
        filesModified: { type: 'array', items: { type: 'string' } },
        changesDescription: { type: 'string' },
        success: { type: 'boolean' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'bug-fix']
}));

/**
 * Type check task
 */
export const typeCheckTask = defineTask('type-check', (args, taskCtx) => ({
  kind: 'shell',
  title: 'Run TypeScript type check',
  description: 'Verify no type errors after modifications',

  shell: {
    command: 'cd /home/hagaybar/projects/TAU_customModule && npx tsc --noEmit 2>&1 | head -50'
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['quality', 'type-check']
}));

/**
 * Verify fix task
 */
export const verifyFixTask = defineTask('verify-fix', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify the fix is complete',
  description: 'Final verification that the fix addresses the issue',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'senior QA engineer',
      task: 'Verify that the implemented fix properly addresses the Hebrew library name mapping issue',
      context: {
        issueDescription: args.issueDescription,
        libraryNameHe: args.libraryNameHe,
        filesModified: args.filesModified
      },
      instructions: [
        'Read the modified files',
        'Verify CsvRow interface now includes libraryNameHe',
        'Verify parseCsv() extracts libraryNameHe from CSV',
        'Verify ShelfMapping interface includes libraryNameHe',
        'Verify buildMappingIndex() creates entries for both English and Hebrew library names',
        'Verify the Google Sheets URL has been updated',
        'Confirm the fix will work for both Hebrew and English UI languages',
        'Return verification result'
      ],
      outputFormat: 'JSON with verified (boolean), verificationDetails (array of strings), issues (array of strings if any)'
    },
    outputSchema: {
      type: 'object',
      required: ['verified', 'verificationDetails'],
      properties: {
        verified: { type: 'boolean' },
        verificationDetails: { type: 'array', items: { type: 'string' } },
        issues: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['verification', 'qa']
}));
