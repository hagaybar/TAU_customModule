/**
 * @process tau-custommodule/dark-mode
 * @description Implement dark mode with system preference detection and manual toggle
 * @inputs { targetQuality: number }
 * @outputs { success: boolean, filesModified: array }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * Dark Mode Implementation Process
 *
 * Features:
 * - System preference detection (prefers-color-scheme)
 * - Manual toggle with localStorage persistence
 * - Angular Material M3 dark theme integration
 * - CSS custom properties for theme colors
 *
 * @param {Object} inputs - Process inputs
 * @param {number} inputs.targetQuality - Target quality score (0-100)
 * @param {Object} ctx - Process context
 * @returns {Promise<Object>} Process result
 */
export async function process(inputs, ctx) {
  const { targetQuality = 80 } = inputs;

  // ============================================================================
  // PHASE 1: DESIGN & PLANNING
  // ============================================================================

  const designResult = await ctx.task(designDarkModeTask, {
    projectType: 'Angular CustomModule for Primo NDE',
    existingTheme: 'm3-theme.scss with $dark-theme already defined',
    requirements: [
      'System preference detection via prefers-color-scheme',
      'Manual toggle button for user override',
      'localStorage persistence of user preference',
      'Smooth transition between themes',
      'RTL/BiDi support compatibility'
    ]
  });

  // Breakpoint: Review design before implementation
  await ctx.breakpoint({
    question: 'Review the dark mode design approach. Approve to proceed with implementation?',
    title: 'Dark Mode Design Review',
    context: {
      runId: ctx.runId,
      files: [
        { path: 'artifacts/dark-mode-design.md', format: 'markdown' }
      ]
    }
  });

  // ============================================================================
  // PHASE 2: IMPLEMENTATION
  // ============================================================================

  // Step 1: Create theme service
  const themeServiceResult = await ctx.task(implementThemeServiceTask, {
    design: designResult
  });

  // Step 2: Update SCSS theme files
  const scssResult = await ctx.task(implementScssThemingTask, {
    design: designResult,
    themeService: themeServiceResult
  });

  // Step 3: Create toggle component
  const toggleResult = await ctx.task(implementToggleComponentTask, {
    design: designResult,
    themeService: themeServiceResult
  });

  // Step 4: Update custom.css for dark mode overrides
  const customCssResult = await ctx.task(updateCustomCssTask, {
    design: designResult
  });

  // ============================================================================
  // PHASE 3: VERIFICATION
  // ============================================================================

  // Build verification
  const buildResult = await ctx.task(verifyBuildTask, {});

  // Visual verification breakpoint
  await ctx.breakpoint({
    question: 'Please verify the dark mode implementation visually. Does it look correct in both light and dark modes?',
    title: 'Visual Verification',
    context: {
      runId: ctx.runId,
      files: []
    }
  });

  // Final quality assessment
  const qualityResult = await ctx.task(assessQualityTask, {
    filesModified: [
      ...themeServiceResult.filesModified || [],
      ...scssResult.filesModified || [],
      ...toggleResult.filesModified || [],
      ...customCssResult.filesModified || []
    ],
    targetQuality
  });

  // ============================================================================
  // PHASE 4: COMPLETION
  // ============================================================================

  // Final approval breakpoint
  await ctx.breakpoint({
    question: `Dark mode implementation complete. Quality: ${qualityResult.score}/${targetQuality}. Approve for commit?`,
    title: 'Final Approval',
    context: {
      runId: ctx.runId,
      files: [
        { path: 'artifacts/implementation-summary.md', format: 'markdown' }
      ]
    }
  });

  return {
    success: qualityResult.score >= targetQuality,
    quality: qualityResult.score,
    targetQuality,
    filesModified: [
      ...themeServiceResult.filesModified || [],
      ...scssResult.filesModified || [],
      ...toggleResult.filesModified || [],
      ...customCssResult.filesModified || []
    ],
    artifacts: {
      design: 'artifacts/dark-mode-design.md',
      summary: 'artifacts/implementation-summary.md'
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

export const designDarkModeTask = defineTask('design-dark-mode', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Design dark mode approach',
  description: 'Create implementation plan using frontend-design skill',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'senior frontend engineer specializing in theming and accessibility',
      task: 'Design the dark mode implementation approach for an Angular application using Material 3',
      context: {
        projectType: args.projectType,
        existingTheme: args.existingTheme,
        requirements: args.requirements
      },
      instructions: [
        'Use /frontend-design skill for best practices',
        'Design theme service with system preference detection',
        'Plan CSS custom properties strategy',
        'Consider accessibility and color contrast',
        'Plan toggle component placement and UX',
        'Output a detailed implementation plan'
      ],
      outputFormat: 'JSON with approach, themeServiceDesign, scssStrategy, toggleDesign, customProperties'
    },
    outputSchema: {
      type: 'object',
      required: ['approach', 'themeServiceDesign'],
      properties: {
        approach: { type: 'string' },
        themeServiceDesign: { type: 'object' },
        scssStrategy: { type: 'object' },
        toggleDesign: { type: 'object' },
        customProperties: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['design', 'frontend']
}));

export const implementThemeServiceTask = defineTask('implement-theme-service', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Implement theme service',
  description: 'Create Angular service for theme management',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular developer',
      task: 'Implement ThemeService for dark mode management',
      context: { design: args.design },
      instructions: [
        'Create ThemeService in src/app/services/',
        'Implement system preference detection with matchMedia',
        'Add localStorage persistence',
        'Provide observable for theme state',
        'Add toggle method',
        'Actually write the code files, do not just describe them'
      ],
      outputFormat: 'JSON with filesCreated, filesModified, summary'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified'],
      properties: {
        filesCreated: { type: 'array', items: { type: 'string' } },
        filesModified: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'angular', 'service']
}));

export const implementScssThemingTask = defineTask('implement-scss-theming', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Update SCSS theme files',
  description: 'Configure M3 dark theme in SCSS',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Frontend CSS/SCSS specialist',
      task: 'Update SCSS files to apply dark theme based on data attribute',
      context: { design: args.design, themeService: args.themeService },
      instructions: [
        'Update styles.scss to apply dark theme when [data-theme="dark"]',
        'Use existing $dark-theme from m3-theme.scss',
        'Add CSS custom properties for colors',
        'Add smooth theme transition',
        'Actually modify the files, do not just describe changes'
      ],
      outputFormat: 'JSON with filesModified, summary'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified'],
      properties: {
        filesModified: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'scss', 'theming']
}));

export const implementToggleComponentTask = defineTask('implement-toggle', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Create theme toggle component',
  description: 'Create UI toggle for dark mode',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular component developer',
      task: 'Create a theme toggle component',
      context: { design: args.design, themeService: args.themeService },
      instructions: [
        'Create ThemeToggleComponent in custom1-module',
        'Use Material icon button with sun/moon icons',
        'Inject ThemeService',
        'Register in customComponentMappings',
        'Actually create the component files'
      ],
      outputFormat: 'JSON with filesCreated, filesModified, summary'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified'],
      properties: {
        filesCreated: { type: 'array', items: { type: 'string' } },
        filesModified: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'angular', 'component']
}));

export const updateCustomCssTask = defineTask('update-custom-css', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Update custom.css for dark mode',
  description: 'Add dark mode overrides to custom.css',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'CSS specialist',
      task: 'Add dark mode overrides to custom.css',
      context: { design: args.design },
      instructions: [
        'Add dark mode variants for existing custom styles',
        'Use [data-theme="dark"] selector',
        'Ensure good contrast in dark mode',
        'Update snackbar colors for dark mode',
        'Actually modify the custom.css file'
      ],
      outputFormat: 'JSON with filesModified, summary'
    },
    outputSchema: {
      type: 'object',
      required: ['filesModified'],
      properties: {
        filesModified: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['implementation', 'css']
}));

export const verifyBuildTask = defineTask('verify-build', (args, taskCtx) => ({
  kind: 'shell',
  title: 'Verify build',
  description: 'Run npm build to verify no errors',

  shell: {
    command: 'npm run build 2>&1 | tail -20'
  },

  io: {
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['verification', 'build']
}));

export const assessQualityTask = defineTask('assess-quality', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Assess implementation quality',
  description: 'Score the dark mode implementation',

  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Quality assessor',
      task: 'Assess the quality of the dark mode implementation',
      context: { filesModified: args.filesModified, targetQuality: args.targetQuality },
      instructions: [
        'Review all modified files',
        'Check for accessibility compliance',
        'Verify theme switching works correctly',
        'Check localStorage persistence',
        'Score overall quality 0-100'
      ],
      outputFormat: 'JSON with score, issues, recommendations'
    },
    outputSchema: {
      type: 'object',
      required: ['score'],
      properties: {
        score: { type: 'number' },
        issues: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  },

  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },

  labels: ['quality', 'assessment']
}));
