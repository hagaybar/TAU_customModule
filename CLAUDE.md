# Instructions for Claude Code

This file contains specific instructions for Claude Code when working with this TAU CustomModule project.

## Project Context

This is Tel Aviv University's customization package for Primo's New Discovery Experience (NDE), based on the ExLibris CustomModule template.

## ExLibris CustomModule Reference Repository

**IMPORTANT:** Always refer to the official ExLibris repository for documentation, examples, and troubleshooting:

**Repository URL:** https://github.com/ExLibrisGroup/customModule

### When to Check the ExLibris Repository

1. **Before implementing new features** - Check for examples and best practices
2. **When troubleshooting** - Look for default file structures and configurations
3. **For documentation** - README.md contains comprehensive setup and development guides
4. **For proxy/theme configuration** - Reference latest proxy setup and Material 3 theme examples
5. **When unsure about file structure** - Compare with default ExLibris implementation

### How to Use the Repository

- **Browse directly:** Navigate through the repository structure to find relevant files
- **Search for files:** Use glob patterns or file search to find specific configurations
- **Read documentation:** Fetch and read the README.md or other documentation files
- **Compare implementations:** Check how ExLibris implements similar features
- **Find examples:** Look for sample components and customization patterns

## TAU-Specific Customizations

This repository contains TAU-specific customizations documented in:
- `README.md` - Summary of all TAU customizations
- `docs/features/` - Detailed feature documentation
- `docs/reference/` - Technical reference documents
- `docs/planning/FUTURE_TASKS.md` - Planned enhancements and future work

## Key Differences from ExLibris Base

1. **Institution ID:** `972TAU_INST`
2. **View IDs:**
   - Production: `NDE`
   - Test: `NDE_TEST` (configured in `build-settings.env`)
3. **Custom Features:**
   - External search integration (ULI, WorldCat, Google Scholar)
   - Call number directionality fixes
   - Custom CSS styling

## Development Workflow

1. **Local development:** Use `npm run start:proxy` with proxy pointing to production
2. **Build settings:** Configure `build-settings.env` before building
3. **Proxy configuration:** `proxy/proxy.const.mjs` determines which Primo instance to proxy to
4. **Custom styles:** Applied via `src/assets/css/custom.css`
5. **Documentation:** Always update relevant docs when making changes

## Critical Build Requirements

**MANDATORY: After ANY changes to `build-settings.env`, you MUST regenerate files:**

```bash
node prebuild.js
# OR
npm run build
```

**Why this is critical:**
- `prebuild.js` reads `build-settings.env` and generates `src/app/state/asset-base.generated.ts`
- This generated file contains the asset path (`ASSET_BASE_URL`) used at runtime
- If not regenerated, asset paths will be wrong, causing 404 errors for all images/icons
- The `prebuild` script runs automatically before `npm run build` but NOT before `git commit`

**Proxy configuration is also parametric:**
- `proxy/customization_config_override.mjs` automatically reads from `build-settings.env`
- No manual updates needed when switching between test/production views
- Proxy paths will always match your current `INST_ID` and `VIEW_ID` settings

**Example of what goes wrong:**
- `build-settings.env` says: `/nde/custom/972TAU_INST-NDE_TEST`
- Generated file still has: `/nde/custom/972TAU_INST-NDE`
- Result: All assets fail to load with 404 errors

**When to regenerate:**
1. After changing `VIEW_ID` in `build-settings.env`
2. After changing `ASSET_BASE_URL` in `build-settings.env`
3. After switching between production/test views
4. Before committing changes to `build-settings.env`

## Important Notes

- The custom module loads as web components into Primo's host application
- Typography and theme changes may not affect the entire Primo UI, only custom components
- Always test changes in the dev environment before building for production
- Maintain documentation for all customizations in the `docs/` folder

## Resources

- **ExLibris Repository:** https://github.com/ExLibrisGroup/customModule
- **Project Documentation:** `docs/` folder
- **Development Guidelines:** `docs/development/AGENTS.md`
- **Future Tasks:** `docs/planning/FUTURE_TASKS.md`
