# Debug scripts

Browser-console scripts used to investigate Primo NDE internals during
development.

| Script | Purpose |
| --- | --- |
| `find_translation_data.js` | Quick check for translation data in the DOM / `window`. |
| `nde_translation_inspector.js` | Inspects the Angular injector for translation services. |
| `translate_directive_inspector.js` | Inspects `translate` directives and their keys. |

## Looking for a label/translation code?

If you just need to know **which label code produces a piece of on-screen text**
(so you can edit it in the Primo–Alma labels table), you usually don't need
these scripts. Add **`debugLabels=true`** to the NDE URL and the UI renders the
codes directly.

See **[Finding Label Codes in Primo NDE](../reference/finding_label_codes.md)**.
