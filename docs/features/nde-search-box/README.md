# NDE embedded search box (library websites)

Replacement for the Drupal-generated Primo VE search box on `libraries.tau.ac.il`
and `en-libraries.tau.ac.il`, for use with the NDE view.

Files:

| File | What it is |
|---|---|
| `nde-search-box.html` | The copy-paste snippet — Hebrew and English forms |
| `devtools-snippet.js` | Paste into the DevTools console on a live library page — swaps the real search block for the NDE one |
| `test-page.html` | Standalone harness: native vs legacy syntax side by side, live URL preview |

## Testing on a live page

Open a library site (e.g. `https://cenlib.tau.ac.il/`), open DevTools → Console,
paste the whole of `devtools-snippet.js`, Enter. Chrome blocks the first console
paste — type `allow pasting` + Enter once.

The existing Drupal block is **hidden, not destroyed**, and the NDE box takes its
place with a live preview of the exact URL it will emit. Searching opens NDE in a
new tab. To put the page back without reloading:

```js
__ndeBox.restore()
```

Change `VID` at the top of the snippet to `972TAU_INST:NDE_TEST` to aim at the test
view. The snippet picks `lang` from `<html lang>`, so it works unchanged on the
English sites.

Verified 2026-09-02 on the live `cenlib.tau.ac.il` home page: block replaced,
`ספרות עברית` → `/nde/search?vid=972TAU_INST:NDE&tab=TAU&search_scope=TAU&lang=he&query=%D7%A1%D7%A4%D7%A8%D7%95%D7%AA%20%D7%A2%D7%91%D7%A8%D7%99%D7%AA`,
14,599 results, `__ndeBox.restore()` restores the original form.

### What the live block does today

`#block-libraries-search-block-libraries-search-block` holds a Drupal antibot form
that **POSTs to `/antibot`**, not to Primo — the visible field is `searchForm`, and
the `query` field is the literal placeholder `primoQuery`, which Drupal rewrites
server-side into `any,contains,<term>` before redirecting. That is why the emitted
URL cannot be read off the page source, and why the fix belongs in the Drupal module
rather than in the markup.

Related: Ex Libris case **10765355** (`docs/troubleshooting/case_10765355/`).

## The URL to emit

```
https://tau.primo.exlibrisgroup.com/nde/search
    ?query=<term>
    &tab=TAU
    &search_scope=TAU
    &vid=972TAU_INST:NDE
    &lang=he            # or en
```

`query` carries the **bare term**. This is byte-for-byte what NDE's own search box
produces when a patron types into it.

## Why not keep `any,contains,<term>`

Measured 2026-09-02 against the live `972TAU_INST:NDE` view, term `shakespeare`:

| query parameter | `mode` | results |
|---|---|---|
| `query=shakespeare` | – | **844,036** |
| `query=any,contains,shakespeare` | – | **211** |
| `query=any,contains,shakespeare` | `Basic` | **211** |
| `query=any,contains,shakespeare` | `advanced` | **844,036** |
| `query=creator,contains,shakespeare` | – | **0** |

In basic mode NDE does not parse the `index,operator,term` triple — it searches the
literal string. The search box then displays `any,contains,shakespeare` and the page
title becomes `DaTA- any,contains,shakespeare`.

There is **no error page**. A patron sees a plausible but much shorter result list.
That is the reason not to leave the current form in place and trust the VE→NDE
redirect: if the redirect passes `query` through unchanged, the degradation is silent
and nobody reports it.

`mode=advanced` is what makes the triple parse. Ex Libris's own documented NDE deep-link
example (`query=any,contains,peace&mode=advanced`) carries it for that reason.

## Legacy parameters

Inert in NDE, safe to delete: `mode`, `displayMode`, `bulkSize`, `highlight`, `dum`,
`displayField`. Keep Drupal's `form_build_id`, `form_id`, `antibot_key` out of the
outbound URL if the module allows it — harmless, but they leak into the Primo address bar.

## Two gotchas

**The vid, not the query, produces "Failed to load view configuration".**
`/nde/search?vid=972TAU_INST:TAU&…` → that error, whatever the query.
`/nde/search?vid=972TAU_INST:NDE&…` → loads normally.

**Direction.** The search input uses `dir="auto"` so it follows whatever the patron
types. Do not hardcode `dir="rtl"` on the input — it mangles Latin-script queries.
The wrapping `<form>` carries `dir="rtl" lang="he"` on the Hebrew site.

## Deployment note

The form above targets `/nde/search` directly, so it does not depend on the VE→NDE
redirect at all. It works **today** against the live NDE view — which also means that
if it goes on the public site before cutover, patrons land in NDE early. Test it on a
staging page, then flip the production form at go-live.

Confirm the post-cutover `vid` with Ex Libris before hardcoding it. The Go-NDE FAQ says
traffic is redirected "to your NDE view", implying `972TAU_INST:NDE` stays correct.
