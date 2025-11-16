# Repository Guidelines

## Project Structure & Module Organization
Angular sources live under `src/app`, organized by feature (`custom1-module`) and shared layers (`services`, `state`, `styles`). Routing is centralized in `src/app/app-routing.module.ts`, while entry points sit in `src/main.ts` and `src/bootstrap.ts` for module federation. Global assets belong in `src/assets`; keep Angular Material themes in `src/styles.scss`. Supporting scripts live at the project root (`prebuild.js`, `postbuild.js`), and integration assets such as proxy settings stay under `proxy/`. Documentation and reference files are organized under `docs/`.

## Build, Test, and Development Commands
Use `npm start` for a hot-reload dev server; it runs `prebuild.js` first to sync environment bundles. `npm run start:proxy` adds the local proxy defined in `proxy/proxy.conf.mjs`. Build production artifacts with `npm run build`, which emits the bundle to `dist/` and triggers `postbuild.js` for packaging. Continuous compilation is available via `npm run watch`, and federated host testing uses `npm run run:all`.

## Coding Style & Naming Conventions
Stick to Angular CLI defaults: TypeScript with 2-space indentation and SCSS for component styles. Feature modules and services should use PascalCase filenames (`CustomPanelModule` in `custom-panel.module.ts`), while components remain kebab-cased (`custom-widget.component.ts`). Keep selectors under the `app-` namespace unless embedding inside another host. Avoid inline templates; place HTML and SCSS beside the component class. Run `npx ng lint` from the Angular CLI if added locally; otherwise follow TypeScript compiler warnings as the source of truth.

## Testing Guidelines
Unit tests rely on Jasmine/Karma. Name specs `<feature>.spec.ts` and colocate them with the source file (`custom-panel.component.spec.ts`). Execute `npm test` for the watch-mode runner, or `npm test -- --code-coverage` to generate the `coverage/` report. Ensure new UI logic has at least one spec covering inputs, outputs, or store interactions from `src/app/state`.

## Commit & Pull Request Guidelines
Commits in this repo favor short, imperative summaries (`Add login facade`, `Fix build proxy`). Group related changes together and avoid WIP messages. For pull requests, include: 1) a concise change description, 2) linked issue or ticket when available, 3) testing evidence (`npm test`, manual steps), and 4) relevant screenshots or GIFs for UI updates. Keep branch names descriptive, e.g., `feature/add-client-config` or `fix/loading-spinner`.

## Environment & Configuration Tips
Project settings read from `build-settings.env`; duplicate it per environment and export required variables before running the build. When integrating with remote hosts, ensure module federation URLs align with `webpack.config.js` and `webpack.prod.config.js`. For local debugging behind corporate proxies, copy `proxy/proxy.conf.mjs` and update target hosts instead of editing production configs.

## ExLibris CustomModule Reference Repository
This project is based on the official ExLibris CustomModule template. For documentation, examples, and default file structures, refer to the upstream repository:

**Repository URL:** https://github.com/ExLibrisGroup/customModule

**Key resources:**
- **README.md** - Complete setup and development guide
- **Default file structures** - Reference implementations for components, themes, and configurations
- **Examples** - Sample components and customization patterns
- **Proxy configuration** - Latest proxy setup for local development
- **Theme customization** - Material 3 theme generation and customization examples

When implementing new features or troubleshooting issues, check the ExLibris repository for:
- Latest best practices and patterns
- Default configurations and file structures
- Example implementations of similar features
- Updated documentation on NDE integration
- Community solutions and patterns

**Usage:** You can browse the repository directly or use tools to search for specific files, configurations, or examples within the repository structure.
