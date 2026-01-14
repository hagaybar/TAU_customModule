---
name: git-expert
description: Comprehensive git and GitHub workflow management for Claude Code sessions. Use this skill when performing git operations including creating commits, managing branches, creating pull requests, or following git best practices. Triggers when user requests commits, mentions git commands, asks to save progress, create checkpoints, or work with GitHub. Essential for ensuring proper commit messages, avoiding dangerous operations, and maintaining clean git history.
---

# Git Expert Skill

Comprehensive git and GitHub workflow instructions for Claude Code sessions.

## Core Principles

**Permission and Autonomy**
- Claude has full permission to make commits without asking
- Commit significant changes proactively and granularly
- Push to GitHub immediately after each commit to ensure backup

**Safety First**
- Never run destructive/irreversible git commands unless explicitly requested
- Always validate before dangerous operations
- Follow git safety protocol strictly

## Git Safety Protocol

### NEVER Do These (Unless Explicitly Requested)

**Prohibited Operations**:
- Update git config
- Force push (`--force`, `-f`)
- Force push to main/master (warn user if requested)
- Hard reset (`git reset --hard`)
- Skip hooks (`--no-verify`, `--no-gpg-sign`)
- Interactive commands (`git rebase -i`, `git add -i`) - not supported in CLI

**Amend Commits Only When ALL Conditions Met**:
1. User explicitly requested amend, OR commit succeeded but pre-commit hook auto-modified files
2. HEAD commit was created by you in this conversation (verify: `git log -1 --format='%an %ae'`)
3. Commit has NOT been pushed to remote (verify: `git status` shows "Your branch is ahead")

**CRITICAL Amend Rules**:
- If commit FAILED or was REJECTED by hook → NEVER amend, create NEW commit
- If already pushed to remote → NEVER amend unless user explicitly requests (requires force push)

## Commit Message Standards

### Purpose and Audience

Commit messages serve as documentation for future Claude Code sessions and developers to understand code evolution. Messages must provide sufficient context to understand what changed and why.

### Format and Content Guidelines

**Tense and Mood**:
- Use present tense and imperative mood: "Add feature" not "Added feature"
- Start with action verb: Add, Update, Fix, Refactor, Remove, etc.

**Structure**:
```
Brief summary line (imperative, specific)

Detailed explanation with:
- Specific implementation details
- Bullet points or numbered lists for major changes
- Reasoning behind changes when not obvious
- References to specific files, functions, or classes modified
- Before/after context for refactoring changes
- Any breaking changes or compatibility impacts
```

**Key Requirements**:
1. **Specificity**: Mention exact files, line numbers, function names when relevant
2. **Context**: Explain why changes were made, not just what was changed
3. **Impact**: Describe how changes affect functionality or architecture
4. **Traceability**: Enable future Claude sessions to understand the evolution
5. **Completeness**: Cover all significant modifications in the commit

### Commit Message Format

**Always use HEREDOC for proper formatting**:
```bash
git commit -m "$(cat <<'EOF'
Brief summary line describing the change

Detailed explanation:
- First major change with specific file reference
- Second major change with reasoning
- Third change with impact description

Technical details:
- Implementation specifics
- Modified functions/classes
- Any breaking changes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### Example Commit Messages

**Good Example - Feature Addition**:
```
Add user authentication validation to login flow

Implement comprehensive input validation for user login:
- Add email format validation in src/auth/validators.py:validate_email()
- Add password strength checking in src/auth/validators.py:check_password_strength()
- Update LoginForm component to display validation errors inline

Technical changes:
- Created new ValidationError exception class for auth errors
- Modified login API endpoint to return 400 with validation details
- Added unit tests in tests/test_auth_validators.py

Impact: Prevents invalid credentials from reaching authentication system,
improves user experience with immediate feedback.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Good Example - Bug Fix**:
```
Fix duplicate invoice payment bug in acquisitions workflow

Resolved critical bug where invoices could be paid multiple times:
- Added check_invoice_payment_status() in src/domains/acquisition.py:342
- Modified mark_invoice_paid() to verify payment status before processing
- Added automatic duplicate protection in mark_invoice_paid() method

Root cause: approve_invoice() step was being skipped, causing error 402459
which led to creating duplicate invoices instead of fixing approval status.

Prevention measures:
- Mandatory approval check before payment processing
- New check_pol_invoiced() helper to detect existing invoices
- Comprehensive logging of payment attempts

Fixes: Duplicate payment incident for POL-5994 (2025-10-23)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Good Example - Refactoring**:
```
Refactor API client error handling with domain-specific exceptions

Reorganized error handling architecture for better debugging:
- Created AlmaRateLimitError, AlmaAuthenticationError in src/client/exceptions.py
- Modified AlmaAPIClient._handle_error_response() to map status codes to exceptions
- Updated all domain classes to catch specific exception types

Before: Generic AlmaAPIError for all failures
After: Specific exception types enable targeted error handling

Benefits:
- Rate limit errors trigger automatic retry logic
- Authentication errors provide clearer user guidance
- Better error tracking in logging system

Files modified:
- src/client/AlmaAPIClient.py (error handling)
- src/client/exceptions.py (new exception classes)
- src/domains/*.py (exception catching)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## When to Commit and Push

### Automatic Commit Triggers

Commit proactively in these situations:

1. **Before starting significant work** - Checkpoint current state
2. **After completing a logical unit of work** - Feature, bug fix, refactor, cleanup
3. **Before and after file removals or renames** - Preserve history
4. **After updating documentation** - Especially CLAUDE.md or skills
5. **After test additions or modifications** - Keep tests synchronized
6. **After major refactoring** - Create clean checkpoints

### Manual Commit Commands

Recognize these phrases as immediate commit instructions:
- "commit" or "commit this" or "commit changes"
- "save progress" or "save this"
- "checkpoint" or "create checkpoint"
- "git commit" (explicit git instruction)

**Workflow for manual commit commands**:
1. Review changes since last commit (`git status`, `git diff`)
2. Create appropriate commit message based on changes
3. Execute `git commit`
4. Push to GitHub with `git push origin main`
5. Confirm both commit and push successful

### Standard Workflow

**Every commit MUST be followed by push**:
```bash
# Make changes
git add [files]
git commit -m "$(cat <<'EOF'
Commit message here
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# IMMEDIATELY push
git push origin main
```

This ensures:
- Work is backed up to GitHub
- Changes are visible to collaborators
- Progress is never lost

### What NOT to Commit

**Never commit**:
- Temporary debug print statements
- API keys or sensitive configuration (credentials, tokens, passwords)
- Large binary files without good reason
- Half-finished features that break existing functionality
- Log files or runtime outputs
- IDE-specific configuration (.vscode/, .idea/)
- Operating system files (.DS_Store, Thumbs.db)
- Dependencies (node_modules/, venv/, __pycache__/)

**Check .gitignore** before committing to ensure sensitive/temporary files are excluded.

## Creating Commits Workflow

### Standard Commit Process

Follow these steps when user requests a commit or when significant work is complete:

**1. Check Current State (Run in Parallel)**:
```bash
# Run these commands in parallel
git status              # See all untracked/modified files
git diff                # See unstaged changes
git diff --staged       # See staged changes
git log -3 --oneline    # See recent commits for message style
```

**2. Analyze Changes**:
- Review what files changed and why
- Determine the nature of changes (feature, fix, refactor, docs, etc.)
- Identify any files that shouldn't be committed
- Draft commit message following standards above

**3. Stage and Commit (Run Sequentially)**:
```bash
# Stage relevant files
git add [specific files or .]

# Commit with detailed message using HEREDOC
git commit -m "$(cat <<'EOF'
Brief summary line

Detailed explanation:
- Change 1
- Change 2
- Change 3

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# Verify commit
git status
```

**4. Push to GitHub**:
```bash
git push origin main
```

**5. Confirm Success**:
Report to user that commit and push completed successfully.

### Handling Commit Failures

**If commit fails due to pre-commit hook**:
1. Fix the issues identified by the hook
2. Stage the fixes
3. Create a NEW commit (do NOT amend unless hook auto-modified files)
4. Push the new commit

**If commit is rejected**:
1. Read the error message carefully
2. Address the underlying issue
3. Create a NEW commit with the fix
4. Never force push unless explicitly requested

## Creating Pull Requests

Use `gh` CLI for all GitHub operations.

### PR Creation Workflow

When user requests a pull request:

**1. Understand Full Change Context (Run in Parallel)**:
```bash
git status                        # Current branch state
git diff                          # Unstaged changes
git diff --staged                 # Staged changes
git log [base-branch]..HEAD       # All commits in this branch
git diff [base-branch]...HEAD     # Full diff from base branch
```

**2. Analyze All Changes**:
- Review ALL commits that will be included (not just latest)
- Understand the complete scope of changes since branch diverged
- Identify the overall purpose and impact

**3. Draft PR Summary**:
Create comprehensive description covering all changes:
- Summary section (1-3 bullet points)
- Test plan (bulleted checklist)
- Any breaking changes or migration notes

**4. Prepare and Create PR (Run in Parallel if Needed)**:
```bash
# Create branch if needed
git checkout -b feature-branch-name

# Push with upstream tracking if needed
git push -u origin feature-branch-name

# Create PR with HEREDOC for body
gh pr create --title "PR title describing overall change" --body "$(cat <<'EOF'
## Summary
- First major change with reasoning
- Second major change with impact
- Third change with context

## Test plan
- [ ] Verify feature works in sandbox environment
- [ ] Run unit tests and ensure passing
- [ ] Test edge cases and error handling
- [ ] Validate with sample data

## Notes
Any additional context, breaking changes, or migration instructions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**5. Return PR URL**:
Provide the PR URL to the user so they can review it.

### PR Best Practices

**Title**:
- Clear, concise description of the change
- Use imperative mood: "Add feature" not "Adds feature"

**Body**:
- Summary: What changed and why (1-3 bullet points)
- Test plan: Checklist of testing steps
- Notes: Breaking changes, migrations, special instructions

**Review All Commits**:
- Don't just look at the latest commit
- Understand the full history from base branch divergence
- Ensure PR description covers all changes

## Branch Management

### Working with Branches

**Create new branch**:
```bash
git checkout -b descriptive-branch-name
```

**Switch branches**:
```bash
git checkout branch-name
```

**Push new branch with tracking**:
```bash
git push -u origin branch-name
```

**Check remote tracking**:
```bash
git status  # Shows if branch is up to date with remote
```

### Branch Naming

Use descriptive names:
- `feature/user-authentication`
- `fix/duplicate-invoice-payment`
- `refactor/error-handling`
- `docs/update-api-guide`

## GitHub CLI Usage

### Common gh Commands

**View PR**:
```bash
gh pr view [number]
gh pr view [number] --web  # Open in browser
```

**List PRs**:
```bash
gh pr list
gh pr list --state all
```

**Check PR status**:
```bash
gh pr status
```

**View PR comments**:
```bash
gh api repos/owner/repo/pulls/123/comments
```

**Work with issues**:
```bash
gh issue list
gh issue view [number]
gh issue create --title "Title" --body "Description"
```

## Git Status Interpretation

### Understanding git status Output

**Clean working tree**:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

**Untracked files**:
```
Untracked files:
  (use "git add <file>..." to include in what will be committed)
        new_file.py
```

**Modified files**:
```
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
        modified:   existing_file.py
```

**Staged changes**:
```
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        modified:   file.py
        new file:   another.py
```

**Branch ahead of remote**:
```
Your branch is ahead of 'origin/main' by 2 commits.
  (use "git push" to publish your local commits)
```

## Common Git Patterns

### Typical Workflows

**Make changes and commit**:
```bash
# Make code changes
git add .
git commit -m "$(cat <<'EOF'
Summary of changes

Detailed explanation here.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

**Undo unstaged changes**:
```bash
git restore file.py  # Restore single file
git restore .        # Restore all files
```

**Unstage files**:
```bash
git restore --staged file.py
```

**View commit history**:
```bash
git log --oneline          # Compact view
git log -10                # Last 10 commits
git log --graph --oneline  # Visual branch history
```

**View specific commit**:
```bash
git show commit-hash
git show HEAD~1  # Previous commit
```

## Troubleshooting

### Common Issues

**Commit rejected by hook**:
- Read hook error message
- Fix the issue (linting, tests, etc.)
- Stage fixes and create NEW commit
- Do NOT amend unless hook auto-modified files

**Merge conflicts**:
- User intervention required
- Explain conflict to user
- Guide resolution process
- Never force push to resolve conflicts

**Detached HEAD state**:
- Explain state to user
- Create branch if needed: `git checkout -b recovery-branch`
- Never make commits in detached HEAD without user awareness

**Push rejected**:
- Usually means remote has changes
- Fetch and review: `git fetch origin`
- Discuss strategy with user (merge, rebase, or pull)
- Never force push unless explicitly requested

## Security and Privacy

### Sensitive Information

**Always check before committing**:
- API keys and tokens
- Passwords and credentials
- Private keys and certificates
- Personal information
- Proprietary business logic

**Use .gitignore**:
- Verify .gitignore includes sensitive patterns
- Check that logs/, .env, credentials files are excluded
- Test with `git status` before committing

**If sensitive data was committed**:
- Inform user immediately
- DO NOT push if not yet pushed
- If already pushed, user must take action (git-filter-branch, BFG Repo-Cleaner)
- Rotate any exposed credentials immediately

## Summary

This skill ensures Claude follows git best practices:
- Write detailed, traceable commit messages
- Commit and push proactively and granularly
- Avoid dangerous operations
- Create well-documented pull requests
- Maintain clean git history
- Protect sensitive information
- Follow standardized workflows

Use this skill for all git operations to maintain consistency and quality across the project.
