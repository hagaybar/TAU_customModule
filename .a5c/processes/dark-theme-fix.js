/**
 * @process dark-theme-fix
 * @description Fix dark mode colors in NDE view following Material Design 2 dark theme principles
 * @inputs { accentColor: string, targetPages: string[], maxIterations: number }
 * @outputs { success: boolean, iterations: number, screenshotsPath: string }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * Dark Theme Fix Process
 *
 * A visual-feedback-driven iterative process to fix dark mode colors:
 * 1. Analyze current state with screenshots
 * 2. Implement Material Design 2 dark theme principles
 * 3. Verify with screenshots
 * 4. Iterate until quality is acceptable
 *
 * Material Design 2 Dark Theme Principles:
 * - Background: #121212 (dark gray, not pure black)
 * - Surface colors: Elevated surfaces get lighter overlays
 * - Text: High emphasis #FFFFFF (87%), Medium #FFFFFF (60%), Disabled #FFFFFF (38%)
 * - Primary colors: Desaturated/lighter variants for dark backgrounds
 * - Elevation: Use white overlays (5%, 7%, 8%, 9%, 11%, 12%, 14%, 15%, 16%)
 *
 * @param {Object} inputs - Process inputs
 * @param {string} inputs.accentColor - Primary accent color (TAU Blue)
 * @param {string[]} inputs.targetPages - Pages to fix (homepage, search, full-view, etc.)
 * @param {number} inputs.maxIterations - Maximum iterations for convergence
 * @param {Object} ctx - Process context
 */
export async function process(inputs, ctx) {
  const {
    accentColor = '#44707b',
    targetPages = ['homepage', 'search-results', 'full-view'],
    maxIterations = 3
  } = inputs;

  // ============================================================================
  // PHASE 1: ANALYZE CURRENT STATE
  // ============================================================================

  const analysisResult = await ctx.task(analyzeCurrentStateTask, {
    targetPages,
    runId: ctx.runId
  });

  // ============================================================================
  // PHASE 2: CREATE COLOR SCHEME
  // ============================================================================

  const colorSchemeResult = await ctx.task(createColorSchemeTask, {
    tauBrandColor: accentColor,
    analysis: analysisResult,
    runId: ctx.runId
  });

  // Breakpoint: Review color scheme before implementation
  await ctx.breakpoint({
    question: 'Review the proposed Material Design 2 dark theme color scheme. Approve to proceed with implementation?',
    title: 'Dark Theme Color Scheme Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: `tasks/${ctx.currentEffectId}/color-scheme.md`, format: 'markdown' }
      ]
    }
  });

  // ============================================================================
  // PHASE 3: ITERATIVE IMPLEMENTATION AND VERIFICATION
  // ============================================================================

  let iteration = 0;
  let qualityPassed = false;
  const iterationResults = [];

  while (iteration < maxIterations && !qualityPassed) {
    iteration++;

    // Step 1: Implement CSS changes
    const implementResult = await ctx.task(implementDarkThemeTask, {
      colorScheme: colorSchemeResult,
      targetPages,
      iteration,
      previousFeedback: iteration > 1 ? iterationResults[iteration - 2].feedback : null,
      runId: ctx.runId
    });

    // Step 2: Take screenshots for verification
    const screenshotResult = await ctx.task(captureScreenshotsTask, {
      targetPages,
      iteration,
      runId: ctx.runId
    });

    // Step 3: Visual quality assessment
    const qualityResult = await ctx.task(assessVisualQualityTask, {
      colorScheme: colorSchemeResult,
      screenshots: screenshotResult,
      iteration,
      runId: ctx.runId
    });

    iterationResults.push({
      iteration,
      implementation: implementResult,
      screenshots: screenshotResult,
      quality: qualityResult,
      feedback: qualityResult.recommendations
    });

    if (qualityResult.passed) {
      qualityPassed = true;
    } else if (iteration < maxIterations) {
      // Breakpoint: Review iteration results
      await ctx.breakpoint({
        question: `Iteration ${iteration} complete. Quality: ${qualityResult.score}/100. Issues found: ${qualityResult.issues.length}. Continue with iteration ${iteration + 1}?`,
        title: `Iteration ${iteration} Review`,
        context: {
          runId: ctx.runId,
          files: [
            { path: `tasks/${ctx.currentEffectId}/iteration-${iteration}-report.md`, format: 'markdown' },
            ...screenshotResult.screenshots.map(s => ({ path: s.path, format: 'image' }))
          ]
        }
      });
    }
  }

  // ============================================================================
  // PHASE 4: FINAL VERIFICATION
  // ============================================================================

  // Take final screenshots of all pages
  const finalScreenshots = await ctx.task(captureScreenshotsTask, {
    targetPages,
    iteration: 'final',
    runId: ctx.runId
  });

  // Final quality check
  const finalQuality = await ctx.task(assessVisualQualityTask, {
    colorScheme: colorSchemeResult,
    screenshots: finalScreenshots,
    iteration: 'final',
    runId: ctx.runId
  });

  // Final breakpoint for approval
  await ctx.breakpoint({
    question: `Dark theme implementation complete. Final quality score: ${finalQuality.score}/100. ${qualityPassed ? 'Quality target met!' : 'Quality target not met after max iterations.'} Approve changes?`,
    title: 'Final Dark Theme Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: `tasks/${ctx.currentEffectId}/final-report.md`, format: 'markdown' },
        ...finalScreenshots.screenshots.map(s => ({ path: s.path, format: 'image' }))
      ]
    }
  });

  return {
    success: qualityPassed,
    iterations: iteration,
    finalQualityScore: finalQuality.score,
    colorScheme: colorSchemeResult,
    screenshotsPath: `tasks/${ctx.currentEffectId}/screenshots/`,
    iterationResults,
    metadata: {
      processId: 'dark-theme-fix',
      timestamp: ctx.now()
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

/**
 * Analyze current dark mode state
 */
export const analyzeCurrentStateTask = defineTask('analyze-dark-mode', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Analyze current dark mode state',
  description: 'Take screenshots and analyze current dark mode issues',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'UI/UX engineer specializing in dark theme design',
      task: 'Analyze the current dark mode implementation in the NDE view and identify all color-related issues',
      context: {
        targetPages: args.targetPages,
        instructions: [
          'Start the dev server if not running (npm run start:proxy)',
          'Navigate to each target page with dark mode enabled',
          'Take screenshots of each page',
          'Identify elements with poor contrast or wrong colors',
          'List all CSS selectors that need fixing',
          'Note Material Design 2 violations'
        ]
      },
      instructions: [
        'Use Playwright browser tools to navigate and screenshot',
        'Enable dark mode by clicking the theme toggle',
        'Document specific color issues with element selectors',
        'Save screenshots to the tasks folder',
        'Return structured analysis'
      ],
      outputFormat: 'JSON with issues array, screenshots array, and recommendations'
    },
    outputSchema: {
      type: 'object',
      required: ['issues', 'screenshots'],
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              selector: { type: 'string' },
              currentColor: { type: 'string' },
              problem: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] }
            }
          }
        },
        screenshots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              page: { type: 'string' },
              path: { type: 'string' }
            }
          }
        },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['analysis', 'dark-mode']
}));

/**
 * Create Material Design 2 compliant color scheme
 */
export const createColorSchemeTask = defineTask('create-color-scheme', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Create dark theme color scheme',
  description: 'Generate Material Design 2 compliant dark theme colors',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Material Design expert and color theory specialist',
      task: 'Create a comprehensive dark theme color scheme following Material Design 2 principles',
      context: {
        tauBrandColor: args.tauBrandColor,
        issues: args.analysis?.issues || [],
        materialDesignPrinciples: {
          background: '#121212 (dark gray, reduces eye strain)',
          surfaceElevation: 'Lighter overlays for elevation (0dp: 0%, 1dp: 5%, 2dp: 7%, 3dp: 8%, 4dp: 9%, 6dp: 11%, 8dp: 12%, 12dp: 14%, 16dp: 15%, 24dp: 16%)',
          textEmphasis: 'High: rgba(255,255,255,0.87), Medium: rgba(255,255,255,0.60), Disabled: rgba(255,255,255,0.38)',
          primaryColors: 'Use lighter/desaturated variants of brand colors',
          errorColor: '#CF6679 for dark theme',
          accentContrast: 'At least 4.5:1 contrast ratio for text'
        }
      },
      instructions: [
        `Calculate a dark-theme-appropriate version of TAU Blue (${args.tauBrandColor})`,
        'Generate surface colors for different elevation levels',
        'Define text colors for different emphasis levels',
        'Create CSS custom properties for all colors',
        'Ensure all colors meet WCAG AA contrast requirements',
        'Document the complete color scheme'
      ],
      outputFormat: 'JSON with colorScheme object containing all CSS custom properties and their values'
    },
    outputSchema: {
      type: 'object',
      required: ['colorScheme', 'cssVariables'],
      properties: {
        colorScheme: {
          type: 'object',
          properties: {
            background: { type: 'string' },
            surfaceBase: { type: 'string' },
            surface1dp: { type: 'string' },
            surface2dp: { type: 'string' },
            surface3dp: { type: 'string' },
            surface4dp: { type: 'string' },
            surface6dp: { type: 'string' },
            surface8dp: { type: 'string' },
            surface12dp: { type: 'string' },
            surface16dp: { type: 'string' },
            surface24dp: { type: 'string' },
            primary: { type: 'string' },
            primaryVariant: { type: 'string' },
            onPrimary: { type: 'string' },
            textHighEmphasis: { type: 'string' },
            textMediumEmphasis: { type: 'string' },
            textDisabled: { type: 'string' },
            error: { type: 'string' },
            link: { type: 'string' },
            linkHover: { type: 'string' }
          }
        },
        cssVariables: { type: 'string' },
        contrastReport: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['color-scheme', 'material-design']
}));

/**
 * Implement dark theme CSS changes
 */
export const implementDarkThemeTask = defineTask('implement-dark-theme', (args, taskCtx) => ({
  kind: 'agent',
  title: `Implement dark theme (iteration ${args.iteration})`,
  description: 'Apply dark theme CSS changes to custom.css',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Frontend CSS engineer',
      task: 'Implement the dark theme color scheme in the custom.css file',
      context: {
        colorScheme: args.colorScheme,
        targetPages: args.targetPages,
        iteration: args.iteration,
        previousFeedback: args.previousFeedback,
        cssFilePath: 'src/assets/css/custom.css'
      },
      instructions: [
        'Read the current custom.css file',
        'Update or add CSS custom properties for dark theme colors',
        'Fix all identified color issues for dark mode',
        'Apply proper surface elevation colors to cards and surfaces',
        'Ensure text has proper contrast ratios',
        'Add elevation overlays where needed',
        'Test by rebuilding if needed (dev server should hot reload)',
        'Address any previous feedback from iterations'
      ],
      outputFormat: 'JSON with filesModified array and changesSummary'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified', 'changesSummary'],
      properties: {
        filesModified: { type: 'array', items: { type: 'string' } },
        changesSummary: { type: 'array', items: { type: 'string' } },
        cssRulesAdded: { type: 'number' },
        cssRulesModified: { type: 'number' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', `iteration-${args.iteration}`]
}));

/**
 * Capture screenshots for verification
 */
export const captureScreenshotsTask = defineTask('capture-screenshots', (args, taskCtx) => ({
  kind: 'agent',
  title: `Capture screenshots (${args.iteration})`,
  description: 'Take screenshots of all target pages in dark mode',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA engineer',
      task: 'Capture screenshots of all target pages with dark mode enabled',
      context: {
        targetPages: args.targetPages,
        iteration: args.iteration,
        devServerUrl: 'http://localhost:4201'
      },
      instructions: [
        'Ensure dev server is running',
        'Navigate to the NDE home page',
        'Enable dark mode using the theme toggle',
        'Capture full-page screenshot of homepage',
        'If search results is in target, perform a search and capture screenshot',
        'If full-view is in target, click on a result and capture screenshot',
        'Save all screenshots with descriptive names',
        'Return paths to all screenshots'
      ],
      outputFormat: 'JSON with screenshots array containing page and path for each'
    },
    outputSchema: {
      type: 'object',
      required: ['screenshots'],
      properties: {
        screenshots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              page: { type: 'string' },
              path: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['screenshots', `iteration-${args.iteration}`]
}));

/**
 * Assess visual quality of dark theme
 */
export const assessVisualQualityTask = defineTask('assess-visual-quality', (args, taskCtx) => ({
  kind: 'agent',
  title: `Assess visual quality (${args.iteration})`,
  description: 'Evaluate dark theme implementation against Material Design principles',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'UI/UX quality assessor and Material Design expert',
      task: 'Evaluate the dark theme implementation quality based on screenshots and Material Design 2 principles',
      context: {
        colorScheme: args.colorScheme,
        screenshots: args.screenshots,
        iteration: args.iteration,
        qualityCriteria: [
          'Background uses #121212 or appropriate dark gray',
          'Cards and surfaces have proper elevation colors',
          'Text has sufficient contrast (at least 4.5:1)',
          'Links are visible and distinguishable',
          'No white or light backgrounds in dark mode',
          'Consistent color scheme across all elements',
          'Brand colors are properly adapted for dark theme'
        ]
      },
      instructions: [
        'View each screenshot carefully',
        'Check each quality criterion',
        'Score overall quality 0-100',
        'List specific issues found',
        'Provide actionable recommendations for improvements',
        'Determine if quality is acceptable (score >= 80)'
      ],
      outputFormat: 'JSON with score, passed boolean, issues array, and recommendations array'
    },
    outputSchema: {
      type: 'object',
      required: ['score', 'passed', 'issues', 'recommendations'],
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
        passed: { type: 'boolean' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              problem: { type: 'string' },
              severity: { type: 'string' },
              suggestion: { type: 'string' }
            }
          }
        },
        recommendations: { type: 'array', items: { type: 'string' } },
        criteriaScores: {
          type: 'object',
          additionalProperties: { type: 'number' }
        }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['quality-assessment', `iteration-${args.iteration}`]
}));
