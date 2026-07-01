# Documentation Index

This directory contains all project documentation organized by topic.

---

## 📁 Directory Structure

### `/features/external-search/`
**External Search Sources Feature Documentation**

- **[EXTERNAL_SEARCH_IMPLEMENTATION.md](features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md)** - Complete technical implementation guide
  - Architecture overview
  - Component details
  - Configuration reference
  - Testing checklist
  - Troubleshooting guide

- **[MIGRATION_SUMMARY.md](features/external-search/MIGRATION_SUMMARY.md)** - AngularJS to Angular 18 migration
  - Before/after comparison
  - Key improvements
  - Performance benefits
  - Code quality enhancements

- **[ICON_SETUP_NOTES.md](features/external-search/ICON_SETUP_NOTES.md)** - Icon installation guide
  - Required icons
  - Where to find them
  - Installation instructions
  - Verification steps

---

### `/features/map_cenlib_shelves/`
**CenLib Shelf Map Feature Documentation**

- **[README.md](features/map_cenlib_shelves/README.md)** - Interactive shelf-location map for the Sourasky Central Library
  - Architecture (button → dialog → SVG) and components
  - Multi-Dimensional Mapping (MDM) data model and CSV schema
  - AWS CloudFront CDN layout (mapping CSV + floor-plan SVGs)
  - Producer-matched Dewey call-number matching (issue #100) and floor-scoping guard (issue #12)
  - How to extend it to another library / collection

- **[validation/mismatch-report.md](features/map_cenlib_shelves/validation/mismatch-report.md)** - Cross-check of CSV `svgCode`s against floor-SVG element IDs

---

### `/troubleshooting/`
**Bug Fixes and Solutions**

- **[BUGFIX_HISTORY.md](troubleshooting/BUGFIX_HISTORY.md)** - Comprehensive bug fix history
  - Bug #1: FilterAssistPanel breaking Primo UI rendering
  - Bug #2: Custom element double registration
  - Root causes and solutions
  - Lessons learned

- **[ASSET_PATH_FIX.md](troubleshooting/ASSET_PATH_FIX.md)** - Asset loading issue resolution
  - 404 error problem analysis
  - ASSET_BASE_URL configuration
  - AutoAssetSrcDirective implementation
  - Verification steps

- **[loading-animation-color-not-themed.md](troubleshooting/loading-animation-color-not-themed.md)** - Load-time animation stays purple, ignores the view color theme
  - Host load-order issue (`--sys-primary` baseline vs. per-view theme) — the default dots cannot be recolored
  - **Resolution:** replace the whole animation via a custom Lottie file in the package
  - Ex Libris Case **10665359** (answered 2026-06-17)

---

### `/research/`
**Research and Integration Notes**

- **[NDE_INTEGRATION_RESEARCH.md](research/NDE_INTEGRATION_RESEARCH.md)** - NDE custom element integration research
  - Official repository analysis
  - Framework workflow understanding
  - Component architecture patterns
  - Best practices discovered

---

### `/development/`
**Development Guidelines**

- **[AGENTS.md](development/AGENTS.md)** - Repository development guidelines
  - Project structure
  - Build commands
  - Coding style
  - Testing guidelines
  - Commit conventions

---

### `/planning/`
**Planning Documents**

- **[feature_plan.md](planning/feature_plan.md)** - External search feature migration plan
  - Original planning document
  - Architecture proposals
  - Migration strategy
  - *(Note: This was the initial plan - see implemented version in `/features/external-search/`)*

---

### `/reference/`
**Reference Materials**

- **[external_sources_feature.txt](reference/external_sources_feature.txt)** - Original AngularJS implementation
  - Source code for migration reference
  - Legacy Primo UI customization
  - Query mapping logic

- **[nde_dom_search_part.txt](reference/nde_dom_search_part.txt)** - NDE DOM structure reference
  - Available NDE component selectors
  - Element hierarchy and attributes
  - Integration point reference

**See**: [Reference README](reference/README.md) for detailed descriptions.

---

### `/assets/troubleshooting/`
**Troubleshooting Screenshots**

Visual documentation of bugs and their resolutions:
- Filter panel rendering issues
- Custom element integration problems
- Development workflow verification
- NDE UI states (before/after fixes)

---

## 🔗 Quick Links

### Getting Started
- [Main README](../README.md) - Project overview and quick start
- [Technical Specifications](../SPECS.md) - Detailed technical specs

### Feature Documentation
- [External Search Implementation](features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md)
- [CenLib Shelf Map](features/map_cenlib_shelves/README.md)

### Troubleshooting
- [Bug Fix History](troubleshooting/BUGFIX_HISTORY.md)
- [Asset Path Fix](troubleshooting/ASSET_PATH_FIX.md)
- [Loading animation color not themed (Ex Libris Case 10665359)](troubleshooting/loading-animation-color-not-themed.md)

### Development
- [Development Guidelines](development/AGENTS.md)
- [NDE Integration Research](research/NDE_INTEGRATION_RESEARCH.md)

---

## 📝 Documentation Standards

### File Naming
- Use UPPERCASE for major documentation files in root
- Use descriptive names that clearly indicate content
- Use hyphens for multi-word names (kebab-case)

### Document Structure
Each documentation file should include:
1. **Title** - Clear, descriptive heading
2. **Date/Status** - When created, current status
3. **Overview** - Brief summary of content
4. **Sections** - Organized with clear headings
5. **Examples** - Code snippets where applicable
6. **References** - Links to related docs

### Maintenance
- Update documentation when features change
- Keep troubleshooting docs current
- Archive outdated planning documents
- Link related documents together

---

## 🆕 Adding New Documentation

When adding new documentation:

1. **Determine category**: features, troubleshooting, research, development, or planning
2. **Create subfolder** if starting a new feature area
3. **Follow naming conventions**: descriptive, UPPERCASE for major docs
4. **Update this index** with a link and brief description
5. **Cross-reference** related docs
6. **Update main README** if it's user-facing documentation

---

## 📊 Documentation Statistics

**Total Documents**: 14 files + 7 screenshots
- Features: 3 documentation files
- Troubleshooting: 2 documentation files + 7 screenshots
- Research: 1 file
- Development: 1 file
- Planning: 1 file
- Reference: 2 files + README
- Assets: 7 troubleshooting screenshots

**Organization**: 7 subdirectories with topical separation

**Last Updated**: 2025-11-10
