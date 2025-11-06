# CustomModule – Technical Specification

## Overview
This project packages Primo New Discovery Experience (NDE) customizations as a standalone Angular 18 micro frontend. The build output is a Module Federation remote (`remoteEntry.js`) that the Primo shell loads to augment UI regions such as recommendations, headers, and other extension points. The repository supplies scaffolding so institutions can add Angular components, static assets, and theme overrides while staying aligned with the April 2025 NDE release.

## Runtime Integration
- **Module Federation remote** (`webpack.config.js`): exposes `./custom-module` → `src/bootstrap.ts` and shares core Angular, RxJS, Material, NgRx, and translation libraries with the host. Assets from `src/assets` are copied into `dist/custom-module/assets` during build.
- **Bootstrap entry point** (`src/bootstrap.ts`): delegates to `@angular-architects/module-federation-tools` to bootstrap the Angular app with `appType: 'microfrontend'` and `production: true`. `bootstrapRemoteApp` is the entry that the NDE shell invokes.
- **AppModule factory** (`src/app/app.module.ts`): exported factory `AppModule({ providers })` returns an Angular module that disables router initialization (`router.dispose()`) to avoid clashes with the host application. At runtime it registers Angular components as custom elements based on `selectorComponentMap`.

## Application Structure
- **Root component** (`src/app/app.component.ts/.html`): placeholder UI (`<p> Custom module test …</p>`). Replace with experience-specific layout if building standalone previews.
- **Custom element registry**: `selectorComponentMap` (`src/app/custom1-module/customComponentMappings.ts`) is intentionally empty. Populate it with pairs such as `['nde-recommendations', RecommendationsComponent]` so Primo can locate custom drop-in components.
- **Services**
  - `AssetBaseService` (`src/app/services/asset-base.service.ts`): reads an injected base URL (generated into `asset-base.generated.ts`) and resolves relative/absolute asset paths.
  - `AutoAssetSrcDirective` (`src/app/services/auto-asset-src.directive.ts`): directive to auto-prefix asset URLs for tags like `<img>`, `<video>`, `<source>`, etc. Falls back to using `background-image` for other elements.
- **State helpers** (`src/app/state`): constants for loading state semantics and generated `assetBaseUrl`.

## Extension Points
- **Angular components**: add components via `ng generate component` and register them in `selectorComponentMap`. NDE drop zones expect selectors such as `nde-recommendations-*`, `nde-header`, etc. (documented in the README).
- **Static assets** (`src/assets`):
  - `homepage/` and `header-footer/`: include `.tmpl` files and guidance for shipping static HTML fragments or remote components.
  - `css/`, `js/`, `images/`, `icons/`: compiled into the final package. Use together with `AutoAssetSrcDirective` to ensure correct URLs when hosted under Primo.
- **Theme overrides**:
  - Default Angular Material v15 (M2) theme lives in `src/styles.scss`.
  - Material 3 palette scaffolding resides in `src/app/styles/`. Uncomment mixins in `_customized-theme.scss` to activate custom themes; `_generate-pallete-color-vars.scss` produces CSS variables for host-level usage.

## Configuration & Build Pipeline
- **Environment file** (`build-settings.env`): provides `INST_ID`/`VIEW_ID` for packaging. Supports optional keys:
  - `ADDON_NAME`: when set, `prebuild.js` renames `src/bootstrap.ts` → `bootstrap<ADDON_NAME>.ts`, rewrites `src/main.ts` to import the renamed file, and updates `webpack.config.js` exposure names.
  - `ASSET_BASE_URL`: surfaced via the generated `asset-base.generated.ts` for runtime asset resolution.
- **Scripts**
  - `prebuild.js`: validates `build-settings.env`, performs the renames above, and regenerates `asset-base.generated.ts`.
  - Angular CLI build (`npm run build`) uses `ngx-build-plus` with Module Federation configuration.
  - `postbuild.js`: renames `dist/custom-module` to `dist/<INST_ID>-<VIEW_ID>` and zips it for Alma upload.
- **Serving options**: `npm run start` for direct development, or `npm run start:proxy` to relay traffic through `proxy/proxy.conf.mjs` against a remote Primo environment (configure target in `proxy.const.mjs`).

## Development Workflow
1. Update `build-settings.env` (and optionally `proxy/proxy.const.mjs`) with institution-specific values.
2. Run `npm install` then `npm run start` (or `npm run start:proxy`). Dev server listens on port 4201 and expects the Primo URL to include `useLocalCustomPackage=true` when bypassing the proxy.
3. Implement custom components/styles/assets and register them via `selectorComponentMap`.
4. Execute `npm run build` to produce a zipped package ready for Alma upload (`dist/<INST>-<VIEW>.zip`).

## Testing & Tooling
- Karma/Jasmine testing is configured (`src/app/services/asset-base.service.spec.ts`) but minimal—add specs for custom components and services.
- Angular CLI analytics disabled; project relies on Angular 18, TypeScript 5.5, NgRx (not yet used in scaffolding), TranslateModule (initialized with empty config), and Angular Material.

## Open Items & Considerations
- `selectorComponentMap` is empty—product teams must populate it with actual NDE integration points.
- `build-settings.env` in-repo lacks `ADDON_NAME` and `ASSET_BASE_URL`; supply these before running `npm run build` to avoid stale Module Federation identifiers and to enable asset prefixing.
- Asset resolution defaults to an empty base URL (`assetBaseUrl = ''`); ensure `ASSET_BASE_URL` points to the Primo-hosted assets location when deploying.
- Verify generated `webpack.config.js` after `prebuild` when toggling between add-ons; the script performs string replacements that assume original file structure.
- Consider adding linting/formatting and CI workflow coverage; none are present out of the box.
