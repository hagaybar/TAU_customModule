# Reference Files

This directory contains reference materials and source files used during development and documentation.

---

## Files

### `external_sources_feature.txt`
**Original AngularJS implementation** of the external search sources feature.

- **Source**: Legacy Primo UI customization (AngularJS)
- **Size**: 9.5KB (208 lines)
- **Purpose**: Reference material for Angular 18 migration
- **Contains**:
  - AngularJS directive definition
  - External search targets configuration (ULI, WorldCat, Google Scholar)
  - Query mapping functions
  - "No Results" page integration
  - Template HTML snippets

**Referenced in**:
- [EXTERNAL_SEARCH_IMPLEMENTATION.md](../features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md)

**Note**: This is the source code that was migrated to Angular 18. See the migration summary for details on changes.

---

### `nde_dom_search_part.txt`
**NDE DOM structure and selector reference.**

- **Source**: Manual DOM analysis of Primo NDE interface
- **Size**: 979KB
- **Purpose**: Reference for available NDE component selectors
- **Contains**:
  - DOM element hierarchy
  - NDE component selectors
  - Element attributes and classes
  - Useful for identifying integration points

**Referenced in**:
- [BUGFIX_HISTORY.md](../troubleshooting/BUGFIX_HISTORY.md)

**Note**: This is a large reference file capturing the NDE UI structure. Use for understanding available selectors when creating new customizations.

---

## Usage

These files should be **kept in version control** as they provide:
1. Historical context for implementation decisions
2. Reference material for understanding NDE structure
3. Source material for future migrations or enhancements

## Related Documentation

- [External Search Feature Implementation](../features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md)
- [Migration Summary (AngularJS → Angular 18)](../features/external-search/MIGRATION_SUMMARY.md)
- [Troubleshooting Screenshots](../assets/troubleshooting/)

---

**Last Updated**: 2025-11-10
