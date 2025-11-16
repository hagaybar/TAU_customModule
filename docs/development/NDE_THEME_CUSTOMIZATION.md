# NDE Theme Customization (SCSS)

This guide explains how to brand Primo NDE with custom colors and typography using the existing theme setup in this repo.

## Files to know
- Active Material v2 theme: `src/styles.scss` (palettes + typography, already applied).
- Optional Material 3 bundle: `src/app/styles/_customized-theme.scss` (scope) and `src/app/styles/m3-theme.scss` (generated palettes; uses system CSS variables).
- Host-level CSS (non-Material selectors): `src/assets/css/custom.css`.
- Assets for preview in proxy mode: `src/assets/...` (e.g., `src/assets/images/library-logo.png`).

## Quick changes (Material v2, already active)
1) **Colors**: edit `$primary` / `$accent` in `src/styles.scss`.
   ```scss
   $primary: mat.m2-define-palette(mat.$m2-blue-grey-palette, 700);
   $accent: mat.m2-define-palette(mat.$m2-amber-palette, A400);
   ```
2) **Typography**: adjust `$custom-typography` in `src/styles.scss` (e.g., `$body-1` size/line-height, `$font-family`).
3) Rebuild or run the dev server; `@include mat.all-component-themes($theme);` already applies it to all Angular Material components in your custom elements.

## Full Material 3 approach (scoped)
1) **Generate/refresh theme**:
   ```bash
   ng generate @angular/material:m3-theme
   # use system-level variables = yes; output to src/app/styles/; pick light or both
   ```
   This updates `src/app/styles/m3-theme.scss`.
2) **Enable + scope** in `src/app/styles/_customized-theme.scss`:
   ```scss
   .custom-nde-theme {
     @include mat.all-component-colors(m3-theme.$light-theme);
     @include mat.system-level-colors(m3-theme.$light-theme);
   }
   ```
3) **Inject the bundle** (it is not injected by default):
   - In `angular.json` for `_customized-theme.scss`, set `inject: true`, **or**
   - Import the emitted `custom.css` into `src/index.html` or `src/styles.scss`.
4) **Scope to NDE**: add `.custom-nde-theme` to the NDE host element (e.g., `nde-app-root`) so only Primo picks up the M3 colors/typography.
5) **Optional dark**: also include `mat.*($dark-theme)` and toggle via a host class or media query if you need dark mode.

## Host-level styling (non-Material)
- Use `src/assets/css/custom.css` for raw NDE DOM selectors (e.g., availability color, call-number direction). This runs outside Angular Material theming.

## Assets and proxy preview
- To preview branded assets in proxy mode, place them under `src/assets/...` (e.g., `src/assets/images/library-logo.png`) and run `npm run start:proxy`.

## Apply and verify
1) Edit SCSS/CSS as needed.
2) Local check: `npm run start:proxy` (recommended) or `npm run start` with `useLocalCustomPackage=true`.
3) Build: `npm run build`; upload the ZIP from `dist/` to Alma (Manage Customization Package for the NDE view).
4) Validate in the NDE view that colors/fonts/assets render as expected and that scoping is correct.
