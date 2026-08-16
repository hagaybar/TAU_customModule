# SB / PSB Refresh Playbook — Alma & Primo NDE

**Last updated:** 2026-08-16
**Supersedes:** `SB_PSB_Refresh_Playbook_Alma_PrimoVE_v2 (1).docx` (pre-NDE, last updated 2026-06-11)
**Applies to:** Tel Aviv University · institution `972TAU_INST` · NDE view `972TAU_INST:NDE`
**Sandbox host:** `https://tau-psb.primo.exlibrisgroup.com`

> **What changed since the pre-NDE version.** Alma-side work (green colour scheme, CDI key) is
> unchanged. The Primo-side work is different: NDE is now the default discovery UI, and TAU's
> NDE customization is an Angular 18 custom module built from
> [`hagaybar/TAU_customModule`](https://github.com/hagaybar/TAU_customModule) — **not** the old
> AngularJS `viewCustom` package. The old CSS/JS steps no longer apply to NDE and have moved to
> [Appendix A](#appendix-a--legacy-primo-ve-view) for the classic VE view, which is still
> reachable in SB. See the [change log](#change-log-vs-the-pre-nde-playbook) at the end.

---

## What a refresh is, and why this playbook exists

Since Primo VE, the Primo instance is configured and managed inside Alma. Alma has a Sandbox (SB /
Premium Sandbox, PSB) environment, which is a **static image of PROD taken on the refresh date**.
From that moment the two environments drift apart: PROD is live and changing constantly, SB changes
only when staff (usually system administrators) make changes in it.

The refresh happens **twice a year — February and August, usually the first Sunday**.

A refresh overwrites everything in SB with PROD's state. Any SB-specific configuration that makes
SB *behave as a sandbox rather than a second production* is therefore destroyed on every refresh and
must be re-applied. That is the whole job below: three settings, plus a set of checks.

---

## Quick checklist (run in order)

| # | Step | Where | Why it's needed after a refresh |
|---|------|-------|--------------------------------|
| 1 | Set the Alma SB colour scheme to **green** | Alma back office | Refresh copies PROD's blue branding; staff must never confuse SB with PROD |
| 2 | Revert the **CDI Key** to `972TAU.TAU.PSTG`, then run the CDI publish job | Alma → Discovery | Refresh copies PROD's CDI key; SB-only activations won't reflect until this is fixed |
| 3 | Re-apply a **non-blue colour theme** to the `972TAU_INST:NDE` view | Alma → Discovery → Configure Views | Refresh copies PROD's `denim_blue` theme; SB's discovery front end would otherwise be pixel-identical to PROD |
| 4 | **Verify** the NDE customization package — do not rebuild | Alma → Configure Views | Same vid as PROD ⇒ PROD's package works as-is; this is a check, not a task |
| 5 | Work through the [post-refresh checks](#5-post-refresh-checks) | SB front end | Confirms 1–4 landed and nothing else drifted |

Steps 1–3 are the only ones that *change* anything. Steps 4–5 are verification.

---

## Prerequisites & roles

- **Alma roles:** General System Administrator (branding) and Discovery Administrator (CDI, Primo
  view configuration).
- **Primo NDE:** access to *Configure Views* and *Manage Customization Package* for the SB instance.
- **Stored outside Alma** (see [section 6](#6-what-to-store-outside-alma)): the PSB CDI Key and
  Customer ID.

---

## 1. Alma SB — set a distinct green colour scheme

*Unchanged from the pre-NDE playbook.*

**Path:** Configuration Menu → General → User Interface Settings → **Alma Logo and Color Scheme**

Set the primary colours to the SB green values below and **Save**. Re-login and confirm the green UI
in SB.

| | SB (apply after every refresh) | PROD (for reference — do not set in SB) |
|---|---|---|
| Primary | `#47761e` | `#1e4776` |
| Top bars | `#244f02` | `#1a406c` |

> Individual users can also set personal themes in Alma. Institutional branding is the safety net —
> don't rely on a user-level setting to tell SB from PROD.

---

## 2. Ensure PSB uses the correct CDI Key

*Unchanged from the pre-NDE playbook.* This is Alma-side Discovery configuration and is unaffected
by the move to NDE.

When the Premium Sandbox is refreshed from PROD, **the CDI Key is copied from production along with
everything else**. Revert it immediately after the refresh.

**Path:** Alma → Configuration Menu → Discovery → Other → **Central Index and proxy set-up**

Set the **CDI Key** to `972TAU.TAU.PSTG`, confirm the **Customer ID**, and **Save**. After saving,
the page normally shows a profile link.

### Key rules to remember

- Sandboxes refreshed from PROD inherit the **PROD** CDI Key unless you replace it.
- PSB keys typically end in `PSTG`; PROD keys typically end in `PPRD`. Ours is `972TAU.TAU.PSTG`.
- Store the PSB key and Customer ID **outside Alma** (secure vault) — refreshes overwrite them.

### Why a separate PSB key (and not PROD's)

| Option | Effect |
|---|---|
| Use the PROD CDI Key in PSB | PSB uses PROD holdings/publishing. SB-only activations won't reflect. **Not ideal.** |
| Use the PSB CDI Key `972TAU.TAU.PSTG` | PSB publishes its own holdings, so SB-only activations behave correctly. **Recommended.** |

### Run the CDI publish job

> This replaces older guidance that referenced *Resources → Publishing → Publishing Profiles*.

1. Go to **Admin → Monitor Jobs → Scheduled Jobs**.
2. With **Job Category = Publishing**, find **Publishing electronic records to Central Discovery
   Index**.
3. From the row action menu (`…`), choose **Run Now**.
4. Monitor in **Admin → Monitor Jobs → Running Jobs**, then in **History**.
5. Expect CDI search / full-text rights to stabilise within **~48–72 hours**. Validate test searches
   after that window, not before.

---

## 3. NDE — re-apply a non-blue colour theme to the SB view

**This section replaces the pre-NDE "Primo VE (PSB) — restore CSS colors and logo links" step.**

### Why the approach changed

The SB NDE view uses **the same vid as PROD — `972TAU_INST:NDE`**. That means the customization
package copied from PROD during the refresh is already correct for SB (see
[section 4](#4-nde-customization-package--verify-do-not-rebuild)). There is nothing broken in the
package to repair.

But it also means SB's discovery front end is **pixel-identical to PROD** after a refresh — which is
the safety problem the old green-CSS step existed to solve.

The fix belongs in the **Back Office colour theme**, not in the package:

- The `972TAU_INST:NDE` view loads `/nde/assets/color-themes/custom-color-theme-denim_blue.css`,
  which sets `--sys-primary: #3f608a` at `html` scope (overriding NDE's `#5e42d8` default).
- `--sys-primary` paints nearly every accent in the UI — the sort-by value, quick-filter chips, the
  search-actions dropdown, expand-options, slide toggles. Switching the preset recolours the whole
  interface in one move.
- It is a **per-view Back Office setting**, so the refresh overwrites it with PROD's value — exactly
  like the CDI Key, and re-applied the same way.
- **No rebuild, no package upload, no divergence between the SB and PROD packages to maintain.**

> **Why not override `--sys-primary` in `custom.css` instead?** Because the vid is shared, an
> SB-specific `custom.css` would require a second package build, a separate upload after every
> refresh, and permanent maintenance of two package variants that must otherwise stay identical.
> The Back Office theme achieves the same result with a single setting.

### What to do

1. Go to **Alma → Configuration Menu → Discovery → Display Configuration → Configure Views** and
   open the **`NDE`** view.
2. Find the view's **colour theme** setting and change it from `denim_blue` to a clearly non-blue
   preset. **Save.**
3. Hard-refresh `https://tau-psb.primo.exlibrisgroup.com/discovery/search?vid=972TAU_INST:NDE` and
   confirm the accents changed.
4. **Record which preset you chose** in the local checklist (see
   [section 6](#6-what-to-store-outside-alma)) so the next refresh re-applies the same one.

**Preset availability:** the `red` preset is confirmed to exist and was verified working on
`972TAU_INST:NDE_TEST` on 2026-06-17 (Ex Libris case 10665359). Whether a **green** preset exists —
matching the Alma SB green from [section 1](#1-alma-sb--set-a-distinct-green-colour-scheme) — has
not been confirmed; check the picker. If green is unavailable, any clearly non-blue preset satisfies
the goal, since the point is *distinguishable from PROD*, not *green specifically*.

> **Known limitation:** the boot loading animation ("four purple dots") is a Lottie file with its
> colours baked in, fetched before the theme CSS loads. It stays purple regardless of the view
> theme, in both SB and PROD. Do not treat it as an environment signal. Details:
> [`docs/troubleshooting/loading-animation-color-not-themed.md`](../troubleshooting/loading-animation-color-not-themed.md).

---

## 4. NDE customization package — verify, do not rebuild

Because SB uses the same vid as PROD, the package's asset base
(`ASSET_BASE_URL=/nde/custom/972TAU_INST-NDE`, generated from `build-settings.env` into
`src/app/state/asset-base.generated.ts`) resolves identically in SB. **The package copied from PROD
during the refresh works in SB unchanged.**

So this step is a check, not a task:

- Open **Configure Views → `NDE` → Manage Customization Package** and confirm a package is present.
- Load the SB front end and confirm TAU customizations render (custom footer, homepage HTML,
  external search sources, call-number directionality).

**If the package ever does need re-uploading, rebuild it from source — do not hunt for an old ZIP:**

```bash
git clone https://github.com/hagaybar/TAU_customModule.git
cd TAU_customModule
npm install
# build-settings.env already targets VIEW_ID=NDE
node prebuild.js      # regenerates src/app/state/asset-base.generated.ts
npm run build         # produces dist/972TAU_INST-NDE.zip
```

Then upload `dist/972TAU_INST-NDE.zip` via **Manage Customization Package**.

> After any package upload the browser will serve the **cached** `custom.css`. Hard-refresh before
> concluding a change didn't land.

---

## 5. Post-refresh checks

### 5a. Confirmed checks

Run these every time; each maps to a step above.

- [ ] Alma SB UI is green and unmistakably distinct from PROD.
- [ ] **Central Index and proxy set-up** shows CDI Key `972TAU.TAU.PSTG` and the correct Customer ID
      — not the PROD key.
- [ ] The CDI publish job ran successfully today. (Re-check search behaviour after ~48–72 hours.)
- [ ] The `972TAU_INST:NDE` view's colour theme is the non-blue SB preset, and the SB front end shows
      it.
- [ ] A customization package is present on the SB `NDE` view and TAU customizations render.
- [ ] After the CDI window, PSB-only activations (e.g. Unpaywall) are reflected in search.

### 5b. Known differences in SB (expected, not regressions)

- **The Shelf Map button does not appear in SB.** `cenlib-map` fetches its mapping CSV and floor-plan
  SVGs from CloudFront (`d3h8i7y9p8lyw7.cloudfront.net`), whose CORS allowlist covers
  `tau.primo.exlibrisgroup.com` and `localhost` only. From `tau-psb...` the fetch is blocked,
  `shouldShow` resolves to `false`, and the button is hidden. **This is expected. Do not report it as
  a regression.** Whether to change it is tracked in
  [issue #47 (allow the SB origin to fetch cenlib-map data from CloudFront)](https://github.com/hagaybar/TAU_customModule/issues/47)
  — the distribution's caching behaviour makes it a non-trivial change.
- **The boot loading animation is purple** in SB and PROD alike — see the note in
  [section 3](#3-nde--re-apply-a-non-blue-colour-theme-to-the-sb-view).
- **CDI results lag the publish job by ~48–72 hours.** An SB-only activation not showing up on
  refresh day is expected.

### 5c. Verify at the next refresh (not yet confirmed)

These have **not** been observed on a post-NDE sandbox refresh. Check them on the next one and
promote whatever proves to be a real, repeating task into the checklist above.

- [ ] **Logo click-through target.** In the old VE view the logo href was hardcoded to PROD and had
      to be patched in `custom.js` after every refresh (see
      [Appendix A](#appendix-a--legacy-primo-ve-view)). In NDE the logo renders as
      `<nde-logo><a><img alt="Library Logo">` and the href is host-generated. Click it in SB, in both
      `he` and `en`, and confirm it stays on `tau-psb...` and does not jump to PROD. If it jumps,
      find the Back Office field that holds it and add it to step 3.
- [ ] **NDE remains the default UI in SB.** SB is an image of PROD and PROD is NDE-default, so this
      should survive — confirm rather than assume.
- [ ] **`972TAU_INST:NDE_TEST` came across from PROD.** If it did, decide whether SB testing should
      use `NDE` or `NDE_TEST`, and note that `NDE_TEST` may need its own colour theme applied too.
- [ ] **Labels.** NDE labels are institution-wide/shared rather than per-view. Confirm that SB
      inherits PROD's labels and that no label re-work is needed after a refresh.
- [ ] **`loadLandingPage`.** This Back Office flag decides whether the view shows the native NDE
      landing page or the legacy homepage HTML from the package. Confirm SB matches PROD after the
      refresh — a mismatch changes which homepage assets are actually used.
- [ ] **Header/footer.** `footer_{en,he}.html` and `homepage_{en,he}.html` are served live from the
      package and link to `tau.ac.il`. Those links are correct in SB too, but confirm the files load
      and the language switch works.

---

## 6. What to store outside Alma

A refresh overwrites SB, so anything needed to rebuild SB's sandbox identity must live elsewhere.

- **PSB CDI Key** (`972TAU.TAU.PSTG`) and **Customer ID** — in the secure password vault.
- **Alma SB colour hexes** — `#47761e` / `#244f02` (also recorded in
  [section 1](#1-alma-sb--set-a-distinct-green-colour-scheme)).
- **The NDE colour theme preset name** chosen in step 3, so the same one is re-applied each time.
- **A one-page local checklist** with the SB base URL (`https://tau-psb.primo.exlibrisgroup.com`),
  the view code (`972TAU_INST:NDE`), and the above values.

**No longer needed:** stashing a copy of the customization package ZIP. The NDE package is built
from [`hagaybar/TAU_customModule`](https://github.com/hagaybar/TAU_customModule) and is reproducible
from source at any time — see [section 4](#4-nde-customization-package--verify-do-not-rebuild).

Apart from the PSB CDI Key recorded above, this playbook contains no environment secrets.

---

## Appendix A — Legacy Primo VE view

**Status: legacy.** NDE is the default UI, but the classic Primo VE view is still reachable in SB.
Apply this appendix **only** if that view is actually in use. It does **not** apply to
`972TAU_INST:NDE` — NDE has no AngularJS `viewCustom` module, no `prm-*` components, and no
`custom.js` controller layer, so none of the selectors or code below exist there.

These steps are preserved verbatim from the pre-NDE playbook.

After a refresh, Primo VE views and their customization packages are copied from PROD, so PROD
colours and links overwrite the PSB setup. Open the package via **Alma → Discovery → Display
Configuration → Configure Views → (PSB View) → Manage Customization Package** (download, edit,
re-zip, upload).

### A.1 CSS — SB green palette (e.g. `/css/custom1.css`)

```css
/* Search bar background (SB) */
.prm-primary-bg,
prm-journals-search-bar,
prm-search-bar,
.prm-spinner.overlay-cover.light-on-dark:after {
    background-color: #47761e; /* SB green */
}

/* Top bar background (SB) */
prm-topbar .top-nav-bar {
    background-color: #244f02; /* SB dark green */
}

/* Keep PROD values in comments for reference:
   PROD primary: #1e4776
   PROD topbar : #1a406c
*/
```

### A.2 Logo click-through — point to PSB, not PROD (e.g. `/js/custom.js`)

```js
(function(){
  'use strict';
  var app = angular.module('viewCustom', []);

  app.controller('prmLogoAfterController', ['$location', function ($location) {
    var vm = this;
    vm.lang = $location.search().lang;

    // TODO: set this to your PSB Primo VE base URL:
    var PSB_BASE = 'https://<your-psb>.primo.exlibrisgroup.com/discovery/search';

    // Keep your existing image logic
    vm.getLogoImage = function () {
      return (vm.lang === 'he')
        ? 'custom/<YOUR_INST-CODE>/img/library-logo.png'
        : 'custom/<YOUR_INST-CODE>/img/library-logo-en.png';
    };

    vm.getLogoLink = function () {
      var vid  = '972TAU_INST:TAU'; // replace if your PSB uses a different vid
      var lang = (vm.lang === 'he') ? 'he' : 'en';
      return PSB_BASE + '?vid=' + vid + '&lang=' + lang;
    };
  }]);

  app.component('prmLogoAfter', {
    bindings: { parentCtrl: '<' },
    controller: 'prmLogoAfterController',
    template:
      '<div class="product-logo-local product-logo" tabindex="0" role="banner" id="banner">' +
      '<a href="{{$ctrl.getLogoLink()}}"><img class="logo-image" translate-attr="{ alt: \'nui.header.logo\' }" ng-src="{{$ctrl.getLogoImage()}}"/></a>' +
      '</div>'
  });
})();
```

### A.3 Legacy validation

- [ ] Logo click opens PSB (both `he` and `en`).
- [ ] Green bars visible in the PSB VE front end.

---

## Change log vs. the pre-NDE playbook

| Pre-NDE playbook (v2, 2026-06-11) | This version |
|---|---|
| §1 Alma SB green colour scheme | **Unchanged** — [section 1](#1-alma-sb--set-a-distinct-green-colour-scheme) |
| §2 CDI key revert + publish job | **Unchanged** — [section 2](#2-ensure-psb-uses-the-correct-cdi-key) |
| §3A CSS green palette via customization package | **Replaced** by the Back Office colour theme — [section 3](#3-nde--re-apply-a-non-blue-colour-theme-to-the-sb-view). Moved to [Appendix A.1](#a1-css--sb-green-palette-eg-csscustom1css) for the legacy VE view. |
| §3B `custom.js` logo controller | **Removed for NDE** — the AngularJS component does not exist there. Moved to [Appendix A.2](#a2-logo-click-through--point-to-psb-not-prod-eg-jscustomjs); an NDE equivalent check is in [section 5c](#5c-verify-at-the-next-refresh-not-yet-confirmed). |
| "Re-apply your PSB customization package" | **Replaced** by a verification step — same vid means PROD's package is already correct in SB. [Section 4](#4-nde-customization-package--verify-do-not-rebuild) |
| "Store your PSB package ZIP" | **Removed** — the package is reproducible from GitHub. [Section 6](#6-what-to-store-outside-alma) |
| — | **New:** [known differences in SB](#5b-known-differences-in-sb-expected-not-regressions) (Shelf Map / CloudFront CORS, boot animation, CDI lag) |
| — | **New:** [verify-at-next-refresh list](#5c-verify-at-the-next-refresh-not-yet-confirmed) for items not yet observed post-NDE |

---

## A note on where this file should live

This playbook currently sits in the TAU customModule repo because that is where the NDE knowledge
is. Long term it belongs in the HQ folder — the target project is still to be decided. It is written
in Markdown so it stays diffable in version control and converts cleanly to `.docx` when HQ needs a
document (`pandoc sb-refresh-playbook.md -o sb-refresh-playbook.docx`).
