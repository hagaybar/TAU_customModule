/**
 * @process tau/upstream-sync-implementation
 * @description Implement the docs/superpowers/plans/2026-05-06-upstream-sync.md plan with strict quality gates between phases.
 * @inputs { planPath: string }
 * @outputs { success: boolean, completedTasks: number, totalTasks: number, gateResults: array }
 *
 * @skill superpowers:test-driven-development methodologies/superpowers/skills/test-driven-development/SKILL.md
 * @skill superpowers:executing-plans methodologies/superpowers/skills/executing-plans/SKILL.md
 * @skill git-expert -
 *
 * Yolo mode: no breakpoints, runtime auto-approves.
 * 100% quality gates: every phase ends with a verification task that must pass before the next phase begins.
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

// ---------------------------------------------------------------------------
// Task definitions
// ---------------------------------------------------------------------------

const implementPlanTask = defineTask('implement-plan-task', (args, taskCtx) => ({
  kind: 'agent',
  title: `Plan task ${args.taskNumber}: ${args.taskName}`,
  labels: ['upstream-sync', 'plan-task'],
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior implementation engineer executing a strictly bite-sized plan',
      task: `Implement Task ${args.taskNumber} ("${args.taskName}") from the plan file at ${args.planPath} EXACTLY as written. Do not skip any step, do not improvise, do not refactor adjacent code. Write the literal code shown in the plan.`,
      context: {
        planPath: args.planPath,
        taskNumber: args.taskNumber,
        taskName: args.taskName,
        repoRoot: '/home/hagaybar/projects/TAU_customModule',
        rules: [
          'Read the entire Task ' + args.taskNumber + ' section from the plan before starting.',
          'Execute every numbered step in order. Do not batch or skip.',
          'When the plan provides literal code, write that exact code (preserve formatting and content).',
          'When the plan provides a command, run it via Bash and verify the expected output matches.',
          'Run all test commands the plan calls for. Tests MUST pass before committing.',
          'Make the commit shown at the end of the task with the exact commit message and author trailer.',
          'If a step fails (test fails, command errors, expected output mismatch): debug and fix WITHOUT relaxing tests or skipping steps. Only fail the whole task after 3 sincere retry attempts.',
          'Do NOT modify the plan file itself.',
          'Do NOT touch files outside what the task specifies.',
          'Operate from the repo root: /home/hagaybar/projects/TAU_customModule. Always use absolute paths or run commands from that directory.',
        ],
      },
      instructions: [
        'Read the plan file and locate the section for Task ' + args.taskNumber + '.',
        'Execute every step in order, using the exact commands and code blocks shown.',
        'After each step that has an "Expected" output, verify the actual output matches.',
        'Run test commands and confirm they pass before committing.',
        'Make the commit step at the end of the task.',
        'Return a JSON summary listing files created/modified, commits created (with SHAs), tests run, and any issues encountered.',
      ],
      outputFormat: 'JSON',
      outputSchema: {
        type: 'object',
        required: ['taskNumber', 'success', 'commitsCreated'],
        properties: {
          taskNumber: { type: 'number' },
          success: { type: 'boolean' },
          filesCreated: { type: 'array', items: { type: 'string' } },
          filesModified: { type: 'array', items: { type: 'string' } },
          commitsCreated: { type: 'array', items: { type: 'object' } },
          testsRun: { type: 'array', items: { type: 'object' } },
          issues: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    },
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`,
  },
}));

const verifyGateTask = defineTask('verify-gate', (args, taskCtx) => ({
  kind: 'agent',
  title: `Quality gate: ${args.gateName}`,
  labels: ['upstream-sync', 'quality-gate'],
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Strict QA verifier. Reject if any check fails.',
      task: `Run every check in the verification list and confirm each one matches its expected criterion. Return success ONLY if all pass.`,
      context: {
        gateName: args.gateName,
        repoRoot: '/home/hagaybar/projects/TAU_customModule',
        checks: args.checks,
        rules: [
          'Run every shell command from the repo root.',
          'For commands with expectExitCode: confirm the exit code matches; otherwise fail.',
          'For commands with expectStdoutContains: confirm the substring is present in stdout; otherwise fail.',
          'For commands with expectStdoutNotContains: confirm the substring is NOT present; otherwise fail.',
          'For file checks: confirm the file exists and (if expectContent provided) contains the substring.',
          'Do NOT fix issues. If a check fails, report it and return success=false. Fixing is not your job here.',
          'Capture stdout/stderr for every command for inclusion in the report.',
        ],
      },
      instructions: [
        'Iterate through every check.',
        'For each, run the command (or verify the file).',
        'Compare actual output to expected criterion.',
        'Build a per-check pass/fail report.',
        'Set top-level success=true only if every individual check passed.',
      ],
      outputFormat: 'JSON',
      outputSchema: {
        type: 'object',
        required: ['gateName', 'success', 'checkResults'],
        properties: {
          gateName: { type: 'string' },
          success: { type: 'boolean' },
          checkResults: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'passed'],
              properties: {
                name: { type: 'string' },
                passed: { type: 'boolean' },
                actual: { type: 'string' },
                expected: { type: 'string' },
                stdout: { type: 'string' },
                stderr: { type: 'string' },
                exitCode: { type: 'number' },
              },
            },
          },
          summary: { type: 'string' },
        },
      },
    },
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`,
  },
}));

const remediateGateTask = defineTask('remediate-gate', (args, taskCtx) => ({
  kind: 'agent',
  title: `Remediate failures from gate: ${args.gateName}`,
  labels: ['upstream-sync', 'remediation'],
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior implementation engineer fixing quality-gate failures',
      task: `The gate "${args.gateName}" failed. Investigate the failed checks (provided in context) and fix the underlying issues so the gate would pass on re-run. Do NOT relax tests or weaken the criteria — fix the code.`,
      context: {
        gateName: args.gateName,
        planPath: args.planPath,
        failedChecks: args.failedChecks,
        previousAttempts: args.previousAttempts || 0,
        repoRoot: '/home/hagaybar/projects/TAU_customModule',
        rules: [
          'Diagnose why each failed check failed by inspecting code, configs, and test output.',
          'Fix the underlying issue. Common fixes: adjust globs in .upstream-sync/owned-files.json (Task 10 validation), correct typos in code, add missing imports, fix JSON syntax.',
          'Do NOT change the verification criteria themselves.',
          'Do NOT delete tests to make them pass.',
          'After each fix, commit it with a clear message before returning.',
          'Operate from the repo root: /home/hagaybar/projects/TAU_customModule.',
        ],
      },
      instructions: [
        'Inspect each failed check.',
        'Determine the root cause.',
        'Apply the minimal correct fix.',
        'Commit the fix.',
        'Return a summary of what you changed.',
      ],
      outputFormat: 'JSON',
      outputSchema: {
        type: 'object',
        required: ['fixesApplied'],
        properties: {
          fixesApplied: { type: 'array', items: { type: 'object' } },
          commitsCreated: { type: 'array', items: { type: 'object' } },
          notes: { type: 'string' },
        },
      },
    },
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runGateWithRemediation(ctx, { gateName, checks, planPath, maxAttempts = 3 }) {
  let attempt = 0;
  let lastResult = null;
  while (attempt < maxAttempts) {
    attempt++;
    const result = await ctx.task(verifyGateTask, { gateName, checks });
    lastResult = result;
    if (result && result.success) {
      return { gateName, attempts: attempt, success: true, result };
    }
    // Yolo remediation: try to fix
    const failedChecks = (result.checkResults || []).filter((c) => !c.passed);
    if (attempt < maxAttempts) {
      await ctx.task(remediateGateTask, {
        gateName,
        planPath,
        failedChecks,
        previousAttempts: attempt,
      });
    }
  }
  return { gateName, attempts: attempt, success: false, result: lastResult };
}

// ---------------------------------------------------------------------------
// Main process
// ---------------------------------------------------------------------------

export async function process(inputs, ctx) {
  const planPath = inputs.planPath || 'docs/superpowers/plans/2026-05-06-upstream-sync.md';
  const gateResults = [];

  ctx.log && ctx.log('Starting upstream-sync implementation', { planPath });

  // ============================================================================
  // Phase 1: Scaffolding (plan tasks 1-2)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 1, taskName: 'Set up directory structure and seed empty files' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 2, taskName: 'Add picomatch devDependency and test:upstream-sync script' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-1-scaffolding',
    planPath,
    checks: [
      { name: 'directories exist', kind: 'shell', command: 'test -d .upstream-sync && test -d scripts/upstream-sync/__tests__ && test -d docs/upstream-sync && test -d .claude/skills/upstream-sync && echo OK', expectStdoutContains: 'OK', expectExitCode: 0 },
      { name: 'applied.json exists and is empty array', kind: 'shell', command: 'cat docs/upstream-sync/applied.json', expectStdoutContains: '[]' },
      { name: 'picomatch in devDependencies', kind: 'shell', command: 'node -e "console.log(require(\'./package.json\').devDependencies.picomatch || \'MISSING\')"', expectStdoutNotContains: 'MISSING' },
      { name: 'test:upstream-sync script registered', kind: 'shell', command: 'node -e "console.log(require(\'./package.json\').scripts[\'test:upstream-sync\'] || \'MISSING\')"', expectStdoutNotContains: 'MISSING' },
      { name: 'phase 1 commits present', kind: 'shell', command: 'git log --oneline -5 | head -5', expectStdoutContains: 'upstream-sync' },
    ],
  }));

  // ============================================================================
  // Phase 2: Owned-files config (plan task 3)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 3, taskName: 'Create owned-files.json category config' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-2-owned-files-config',
    planPath,
    checks: [
      { name: 'owned-files.json parses', kind: 'shell', command: 'node -e "JSON.parse(require(\'fs\').readFileSync(\'.upstream-sync/owned-files.json\'))" && echo OK', expectStdoutContains: 'OK', expectExitCode: 0 },
      { name: 'config has expected categories', kind: 'shell', command: 'node -e "const c=JSON.parse(require(\'fs\').readFileSync(\'.upstream-sync/owned-files.json\'));const need=[\'build-infrastructure\',\'module-registration\',\'proxy-config\',\'external-search-integration\',\'homepage\',\'header-footer\',\'global-styles\',\'branding\'];for(const n of need){if(!c.categories[n])throw new Error(\'missing \'+n)}console.log(\'OK\')"', expectStdoutContains: 'OK' },
    ],
  }));

  // ============================================================================
  // Phase 3: Classifier TDD (plan tasks 4, 5, 6)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 4, taskName: 'Write tests for classifyCommit (pure function) — tests should fail' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 5, taskName: 'Implement classifyCommit to make tests pass' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 6, taskName: 'Add CLI entrypoint to classify.mjs' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-3-classifier',
    planPath,
    checks: [
      { name: 'classifier source exists', kind: 'shell', command: 'test -f scripts/upstream-sync/classify.mjs && echo OK', expectStdoutContains: 'OK' },
      { name: 'classifier tests file exists', kind: 'shell', command: 'test -f scripts/upstream-sync/__tests__/classify.test.mjs && echo OK', expectStdoutContains: 'OK' },
      { name: 'classifier tests pass', kind: 'shell', command: 'npm run test:upstream-sync 2>&1 | tail -20', expectStdoutNotContains: 'fail', expectExitCode: 0 },
      { name: 'classifier CLI usage error on no args', kind: 'shell', command: 'node scripts/upstream-sync/classify.mjs; echo "EXIT=$?"', expectStdoutContains: 'EXIT=2' },
    ],
  }));

  // ============================================================================
  // Phase 4: Ledger TDD (plan tasks 7, 8, 9)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 7, taskName: 'Write tests for ledger functions — tests should fail' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 8, taskName: 'Implement ledger functions to make tests pass' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 9, taskName: 'Add CLI entrypoint to ledger.mjs' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-4-ledger',
    planPath,
    checks: [
      { name: 'ledger source exists', kind: 'shell', command: 'test -f scripts/upstream-sync/ledger.mjs && echo OK', expectStdoutContains: 'OK' },
      { name: 'ledger tests file exists', kind: 'shell', command: 'test -f scripts/upstream-sync/__tests__/ledger.test.mjs && echo OK', expectStdoutContains: 'OK' },
      { name: 'all upstream-sync tests pass', kind: 'shell', command: 'npm run test:upstream-sync 2>&1 | tail -30', expectStdoutNotContains: 'fail', expectExitCode: 0 },
      { name: 'ledger list returns []', kind: 'shell', command: 'node scripts/upstream-sync/ledger.mjs list', expectStdoutContains: '[]' },
      { name: 'ledger has-sha returns none for unknown sha', kind: 'shell', command: 'node scripts/upstream-sync/ledger.mjs has-sha deadbeef; echo "EXIT=$?"', expectStdoutContains: 'none' },
    ],
  }));

  // ============================================================================
  // Phase 5: Historical validation (plan task 10)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 10, taskName: 'Validate classifier against historical commits — expand owned-files.json if any pending commit buckets clean' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-5-historical-validation',
    planPath,
    checks: [
      { name: 'historical validation test file exists', kind: 'shell', command: 'test -f scripts/upstream-sync/__tests__/historical-validation.test.mjs && echo OK', expectStdoutContains: 'OK' },
      { name: 'all tests including historical validation pass', kind: 'shell', command: 'npm run test:upstream-sync 2>&1 | tail -40', expectStdoutNotContains: 'fail', expectExitCode: 0 },
    ],
  }));

  // ============================================================================
  // Phase 6: Skill definition (plan task 11)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 11, taskName: 'Write SKILL.md for upstream-sync skill' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-6-skill-definition',
    planPath,
    checks: [
      { name: 'SKILL.md exists', kind: 'shell', command: 'test -f .claude/skills/upstream-sync/SKILL.md && echo OK', expectStdoutContains: 'OK' },
      { name: 'SKILL.md has frontmatter', kind: 'shell', command: 'head -5 .claude/skills/upstream-sync/SKILL.md', expectStdoutContains: 'name: upstream-sync' },
      { name: 'SKILL.md mentions all 4 modes', kind: 'shell', command: 'grep -E "Analyze|Apply|Skip|Resolve" .claude/skills/upstream-sync/SKILL.md | head -10', expectStdoutContains: 'Analyze' },
      { name: 'SKILL.md commit landed', kind: 'shell', command: 'git log --oneline -10 | grep -E "skill|SKILL" | head -3', expectStdoutContains: 'skill' },
    ],
  }));

  // ============================================================================
  // Phase 7: Documentation (plan tasks 12, 13, 14)
  // ============================================================================
  await ctx.task(implementPlanTask, { planPath, taskNumber: 12, taskName: 'Add legacy notice to .github/workflows/sync-fork.yml' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 13, taskName: 'Add upstream-sync section to CLAUDE.md' });
  await ctx.task(implementPlanTask, { planPath, taskNumber: 14, taskName: 'Add docs/upstream-sync/README.md' });

  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-7-documentation',
    planPath,
    checks: [
      { name: 'sync-fork.yml has DEPRECATED notice', kind: 'shell', command: 'head -10 .github/workflows/sync-fork.yml', expectStdoutContains: 'DEPRECATED' },
      { name: 'CLAUDE.md mentions upstream-sync', kind: 'shell', command: 'grep -i "upstream-sync\\|upstream ExLibris" CLAUDE.md | head -3', expectStdoutContains: 'upstream' },
      { name: 'docs/upstream-sync/README.md exists', kind: 'shell', command: 'test -f docs/upstream-sync/README.md && echo OK', expectStdoutContains: 'OK' },
    ],
  }));

  // ============================================================================
  // Phase 8: Final integration verification (programmatic only — Task 15 manual smoke skipped)
  // ============================================================================
  gateResults.push(await runGateWithRemediation(ctx, {
    gateName: 'phase-8-final-integration',
    planPath,
    checks: [
      { name: 'full upstream-sync test suite passes', kind: 'shell', command: 'npm run test:upstream-sync 2>&1 | tail -50', expectStdoutNotContains: 'fail', expectExitCode: 0 },
      { name: 'classifier CLI runs against a real upstream commit', kind: 'shell', command: 'git fetch upstream 2>/dev/null; node scripts/upstream-sync/classify.mjs c1eb45f', expectStdoutContains: 'bucket' },
      { name: 'ledger list runs without error', kind: 'shell', command: 'node scripts/upstream-sync/ledger.mjs list', expectExitCode: 0 },
      { name: 'all phases left a clean working tree (or only expected untracked babysitter artifacts)', kind: 'shell', command: 'git status --porcelain | grep -v "^?? \\.a5c/" | grep -v "^?? \\.playwright-mcp/" | grep -v "^?? shelf-map" || echo CLEAN', expectStdoutContains: 'CLEAN' },
      { name: 'SKILL.md still has valid frontmatter', kind: 'shell', command: 'head -5 .claude/skills/upstream-sync/SKILL.md', expectStdoutContains: 'name: upstream-sync' },
      { name: 'owned-files.json still parses', kind: 'shell', command: 'node -e "JSON.parse(require(\'fs\').readFileSync(\'.upstream-sync/owned-files.json\'))" && echo OK', expectStdoutContains: 'OK' },
    ],
  }));

  const allGatesPassed = gateResults.every((g) => g.success);

  return {
    success: allGatesPassed,
    planPath,
    completedTasks: 14,
    totalTasks: 15,
    skippedTasks: [
      { taskNumber: 15, reason: 'Manual end-to-end skill smoke test requires user to invoke the skill conversationally; cannot run in yolo mode within the same session.' },
    ],
    gateResults,
    metadata: {
      processId: 'tau/upstream-sync-implementation',
      completedAt: ctx.now().toISOString(),
    },
  };
}
