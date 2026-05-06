# `docs/upstream-sync/`

Artifacts produced by the **`upstream-sync`** Claude Code skill (`.claude/skills/upstream-sync/SKILL.md`).

## What's here

- `applied.json` — the **decisions ledger**. Each entry records an upstream commit that was either applied (cherry-picked into the fork) or explicitly skipped, with a timestamp and (for skips) a reason. The skill reads this on every Analyze run to filter out already-decided commits.
- `<YYYY-MM-DD>.md` — **analysis reports** from each Analyze run. One file per day; running Analyze twice the same day overwrites that day's file (git history preserves prior versions).
- `README.md` — this file.

## Don't hand-edit `applied.json` lightly

The ledger is appended to atomically by the skill at the end of a successful apply. Hand-editing is supported (e.g., to remove a stale skip), but:

- Keep the JSON valid.
- Keep entries chronological.
- Required fields: `sha` (full), `decision` (`applied` | `skipped`), `appliedAt` (ISO date).

## Related

- **Skill:** `.claude/skills/upstream-sync/SKILL.md`
- **Config:** `.upstream-sync/owned-files.json`
- **Scripts:** `scripts/upstream-sync/`
- **Spec:** `docs/superpowers/specs/2026-05-06-upstream-sync-design.md`
