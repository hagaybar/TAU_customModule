# Research Assistant Component - Rollback Guide

**Last Updated**: 2025-11-13
**Current Branch**: `ra-message`
**Current Commit**: `768cb40`

---

## Quick Rollback Reference

If you encounter issues with the Research Assistant component, use this guide to rollback to a known working state.

---

## Safe Rollback Points

### ✅ Current Version (Production-Ready)
**Commit**: `768cb40`
**Message**: "Remove old research-assistant-test component"
**Component**: `research-assistance-custom-text`
**Features**:
- Production-ready component name
- Text splitting (bold + gray)
- Language switching (English ↔ Hebrew)
- Same-page navigation handling
- CSS visibility control (hides flash)
- Clean code (no test artifacts)

**Rollback command**:
```bash
git checkout 768cb40
npm run build
```

---

### ✅ Last Version with Backup Component
**Commit**: `b0b0566`
**Message**: "Rename Research Assistant component to production-ready name"
**Component**: `research-assistance-custom-text` (with backup)
**Features**: Same as current, but keeps old `research-assistant-test` component as backup

**Use this if**: You want both components available for comparison

**Rollback command**:
```bash
git checkout b0b0566
npm run build
```

---

### ✅ Last Version Before Rename (CSS Fix Included)
**Commit**: `1f27a83`
**Message**: "Improve: Eliminate flash of original content with CSS"
**Component**: `research-assistant-test`
**Features**:
- Text splitting (bold + gray)
- Language switching
- Same-page navigation handling
- CSS visibility control (hides flash)

**Use this if**: The rename broke something unexpectedly

**Rollback command**:
```bash
git checkout 1f27a83
npm run build
```

---

### ✅ Version Without CSS Flash Fix
**Commit**: `08fce4f`
**Message**: "Fix: Add MutationObserver for same-page navigation"
**Component**: `research-assistant-test`
**Features**:
- Text splitting (bold + gray)
- Language switching
- Same-page navigation handling
- ⚠️ Brief flash of original content visible

**Use this if**: CSS visibility control causes issues (disappearing text)

**Rollback command**:
```bash
git checkout 08fce4f
npm run build
```

---

### ✅ Original Working Implementation
**Commit**: `882c0d8`
**Message**: "Implement Research Assistant text customization with Alma labels"
**Component**: `research-assistant-test`
**Features**:
- Text splitting (bold + gray)
- Language switching
- ⚠️ No same-page navigation handling
- ⚠️ Flash of original content visible
- ⚠️ Verbose console logging

**Use this if**: All else fails - this is the first fully working version

**Rollback command**:
```bash
git checkout 882c0d8
npm run build
```

---

## Complete Commit History (Newest to Oldest)

| Commit | Date | Description | Component Name |
|--------|------|-------------|----------------|
| `768cb40` | 2025-11-13 | Remove old research-assistant-test component | `research-assistance-custom-text` |
| `b0b0566` | 2025-11-13 | Rename Research Assistant component to production-ready name | `research-assistance-custom-text` (+ backup) |
| `1f27a83` | 2025-11-13 | Improve: Eliminate flash of original content with CSS | `research-assistant-test` |
| `1cef158` | 2025-11-13 | Cleanup: Add troubleshooting log for research assistant navigation | `research-assistant-test` |
| `08fce4f` | 2025-11-13 | Fix: Add MutationObserver for same-page navigation | `research-assistant-test` |
| `d8d8171` | 2025-11-13 | Cleanup: Simplify method comments | `research-assistant-test` |
| `64e65d2` | 2025-11-13 | Cleanup: Shorten component header comment | `research-assistant-test` |
| `e20239a` | 2025-11-13 | Cleanup: Remove language change console log | `research-assistant-test` |
| `9490670` | 2025-11-13 | Cleanup: Remove constructor console log | `research-assistant-test` |
| `882c0d8` | 2025-11-13 | Implement Research Assistant text customization with Alma labels | `research-assistant-test` |

---

## Rollback Procedures

### Temporary Rollback (Testing)

Use this to test an older version without affecting your current branch:

```bash
# Checkout specific commit (detached HEAD state)
git checkout <commit-hash>

# Example: Test original implementation
git checkout 882c0d8

# Build and test
npm run build

# Upload dist/972TAU_INST-NDE_TEST.zip to Alma and test

# Return to latest version
git checkout ra-message
```

---

### Permanent Rollback (Revert Changes)

Use this if you need to permanently go back to an older version:

**Option 1: Soft Reset (Keeps Changes Staged)**
```bash
# Reset to commit but keep changes
git reset --soft <commit-hash>

# Example: Go back to version before rename
git reset --soft 1f27a83

# Check what was undone
git status

# Rebuild
npm run build
```

**Option 2: Hard Reset (Discards All Changes)**
```bash
# ⚠️ WARNING: This PERMANENTLY deletes uncommitted changes!

# Reset to commit and discard all changes
git reset --hard <commit-hash>

# Example: Go back to original implementation
git reset --hard 882c0d8

# Force push to remote (if already pushed)
git push origin ra-message --force
```

**Option 3: Revert Commits (Safe for Shared Branches)**
```bash
# Create new commit that undoes changes
git revert <commit-hash>

# Example: Undo the component removal
git revert 768cb40

# Push to remote
git push origin ra-message
```

---

### File-Level Rollback

Use this to restore a specific file from an older commit:

```bash
# Restore single file from specific commit
git checkout <commit-hash> -- <file-path>

# Example: Restore old component
git checkout 1f27a83 -- src/app/custom1-module/research-assistant-test/

# Or restore mappings file
git checkout 1f27a83 -- src/app/custom1-module/customComponentMappings.ts

# Build and test
npm run build

# Commit if it works
git add .
git commit -m "Restore research-assistant-test component"
```

---

## Testing After Rollback

After rolling back, always verify:

1. **Build succeeds**:
   ```bash
   npm run build
   ```

2. **Upload to Alma**:
   - Upload `dist/972TAU_INST-NDE_TEST.zip` to Alma BO

3. **Test functionality**:
   - [ ] Navigate to Research Assistant page
   - [ ] Text splits into 2 parts (bold + gray)
   - [ ] Switch language English → Hebrew
   - [ ] Switch language Hebrew → English
   - [ ] Navigate RA → RA (same-page navigation)
   - [ ] Check browser console for errors

4. **If working**, commit and push:
   ```bash
   git add .
   git commit -m "Rollback to working version <commit-hash>"
   git push origin ra-message
   ```

---

## Component File Locations by Version

### Current Version (768cb40 - 768cb40)
```
src/app/custom1-module/
├── research-assistance-custom-text/          ← NEW production component
│   ├── research-assistance-custom-text.component.ts
│   ├── research-assistance-custom-text.component.html
│   └── research-assistance-custom-text.component.scss
└── customComponentMappings.ts                 ← Uses ResearchAssistanceCustomTextComponent
```

### Previous Versions (882c0d8 - 1f27a83)
```
src/app/custom1-module/
├── research-assistant-test/                   ← OLD test component
│   ├── research-assistant-test.component.ts
│   ├── research-assistant-test.component.html
│   └── research-assistant-test.component.scss
└── customComponentMappings.ts                 ← Uses ResearchAssistantTestComponent
```

---

## Emergency Contact

If you need to restore the component quickly:

**Fastest rollback to last known stable version**:
```bash
git reset --hard 1f27a83
npm run build
# Upload and test
```

This gives you:
- Proven working implementation
- All features (text split, language switching, navigation)
- CSS flash fix included
- Original component name (easy to identify)

---

## Notes

- All commits from `882c0d8` onwards are working versions
- The main difference between versions is:
  - Component naming (`-test` vs `-custom-text`)
  - CSS flash fix (present in `1f27a83` and later)
  - Navigation handling (present in `08fce4f` and later)
  - Code cleanup (comments and logging)

- **Recommended rollback point**: `1f27a83` (all features, proven stable)

---

**Created**: 2025-11-13
**Created by**: Claude Code
**Branch**: `ra-message`
**Status**: READY FOR USE
