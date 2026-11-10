# Label Inspector (bookmarklet)

Point at any text in Primo NDE and see **which label code produces it**, with the label's current
value, without reloading the page or changing its layout. Issue #54.

A maintainer tool. It lives outside `src/` and is never part of the custom package.

## Install (once)

1. Open `bookmarklet.txt` in this folder and copy its whole content (one line starting with `javascript:`).
2. In your browser, add a new bookmark (Chrome: right-click the bookmarks bar → *Add page…*).
3. Name it `TAU Label Inspector` and paste the copied line as the URL.

## Use

1. Open any Primo NDE page, for example `…/nde/home?vid=972TAU_INST:NDE&lang=he`.
2. Click the bookmark. A panel opens at the bottom left.
3. Hover: the element under the pointer is outlined. Click: the panel lists the matching label codes.
   Clicks are captured while the inspector is on, so links and buttons do not fire.
4. The search box filters the whole label list by code or value ("which code holds this Hebrew text?").
5. Press **Escape**, click **Close**, or click the bookmark again to turn it off. Nothing is left in the page.

For each match the panel shows the code, the **raw value** (markup visible, e.g. `<B>שאלו אותנו</B>`),
a Copy button, and how it was matched (the element's text, an attribute such as `aria-label` or
`placeholder`, or an ancestor's text).

## Reading the results

- **Several codes can share one value.** All are listed; the likeliest is first, ranked by where
  the element sits (inside the main menu → `mainmenu.*` first, and so on). Ranking never hides a match.
- **The code shown is the resolved one.** In Alma the row to edit may be that code or a view-scoped
  override (`972TAU_INST:NDE.<code>`). That is why `NDE` and `NDE_TEST` can show different text for
  the same code.
- **Labels with placeholders** (`{{count}} results`) are matched against the filled-in text, and
  rank below exact matches.
- **No match** means the text is not a label: it is record data, or text from the custom module.

It reads `vid` and `lang` from the page URL and fetches
`/primaws/rest/pub/translations/<vid>?lang=<lang>&vid=<vid>`, the same request Primo makes. If that
fails, the panel says so in red.

Compared with Ex Libris's `&debugLabels=true`: no reload (UI state survives), no layout change, and
you see the value as well as the code.

## Changing it

Edit `label-inspector.js`, then regenerate the bookmarklet:

```bash
node tools/label-inspector/build.mjs
```

`npm run test:scripts` fails if `bookmarklet.txt` is out of date with the source. Only whole-line
`//` comments are allowed in the source; the build strips them.

While it is active, `__tauLabelInspector.lookup(element)` in the console returns the ranked matches.
