# AGENTS.md — the reviewer's brief

<!-- From the factory template in hagaybar/agent-sandbox docs/factory/templates/AGENTS.md.
     Codex reviews, Claude builds (decision 2026-11-24). Edit only "This repo's review focus". -->

## Your role

You are the **independent reviewer** of this repository. Another agent (Claude) builds; you check.
- **Report only.** Never edit, create or delete files, commit, push, open or merge pull requests.
- You review what you are pointed at: a pull request, a branch, or a diff.

## The rules you check against

Read `CLAUDE.md` in this repository. Its rules, commands and links are the standard every change
must meet. When a rule there and a change disagree, the change is the finding.

## How to verify

- **Run the tests yourself** with the commands in `CLAUDE.md`. Never accept "tests pass" from a PR
  description or a commit message.
- Read the code that changed, and the code that calls it.
- Errors must surface: a caught exception that is silently ignored is a finding.
- A changed behaviour without a test that would fail without it is a finding.

## This repo's review focus

- `main` is production (the live `NDE` view): a change that edits the wrong view family, or touches the build without a `npm run compare:packages` run against `main`'s package (`CLAUDE.md`, "Per-view content").
- An edit to a generated, gitignored file (e.g. `src/assets/css/custom.css`) instead of `src/assets/views/<family>/`, or a new per-view asset without its `.gitignore` entry (packages turn `-dirty`).
- A hand edit of `VIEW_ID` or `ASSET_BASE_URL` in `build-settings.env`, or a view family inferred from the view name instead of `VIEW_FAMILY` in `scripts/select-view.mjs`.
- An ungated `console.log`/`warn`/`info` in a shipped component, or any logging of host components, DOM nodes or patron form data (`CLAUDE.md`, "Debug logging", issue #10).
- An edit to a file still identical to `upstream/main` (e.g. `prebuild.js`) where a new script under `scripts/` would do (`CLAUDE.md`, "Syncing with upstream").

## How to report

One finding per item, most serious first:
- `file:line` — what goes wrong, in a concrete case (input or state → wrong result)
- how sure you are: **certain** (you ran it), **likely**, or **check this**
- a suggested fix, in one line

If you find nothing, say so in one line, and name what you checked.
