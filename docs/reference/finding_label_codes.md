# Finding Label Codes in Primo NDE (`debugLabels=true`)

**Status**: Reference / development tip
**Applies to**: Primo NDE (New Discovery Experience)

---

## The problem

When you need to change a piece of UI text in Primo NDE (a button caption, a
message, a tooltip, etc.), the hard part is usually *finding which label code*
produces that text. The labels/code tables in the Primo–Alma configuration are
large, and the rendered text alone doesn't tell you the underlying code.

Historically this repo tackled that with browser-console scripts that inspect
the DOM and Angular injector to dig translation keys out of the running app
(see [`docs/debug/`](../debug/)). Those still work, but there is a built-in,
far simpler way.

## The trick

Append **`debugLabels=true`** to the NDE URL's query string. The UI then renders
each label's **code** in place of its translated text, so you can read the exact
code straight off the screen.

```
https://tau.primo.exlibrisgroup.com/nde/home?vid=972TAU_INST:NDE&lang=he&debugLabels=true
```

- Works on **any** NDE page — just add `&debugLabels=true` to whatever URL you
  are already on (search results, full record, account, etc.).
- The code is **language-independent**: the same code maps to a translation per
  language, so `lang=he` and `lang=en` show the same code, just different text
  when the flag is off. Switch `lang` to confirm both translations exist.
- To turn it off, remove the `debugLabels` parameter (or set it to `false`) and
  reload.

## Using the code to edit the right label

1. Browse the NDE page with `debugLabels=true` and read the code shown where the
   text you want to change normally appears (codes look like
   `nui.<area>.<key>`).
2. In the Primo–Alma configuration, open the labels / UI code tables
   (**Configuration → Discovery → Display Configuration → Labels** in Primo VE)
   and **search for that exact code**.
3. Edit the value for the relevant language(s). This guarantees you are editing
   the label that actually drives the text on screen — no guesswork.

## Why this matters

- Removes the guesswork in matching on-screen text to a label code.
- Avoids editing the wrong label (many labels share similar wording).
- Replaces the need for the DOM/injector inspector scripts in `docs/debug/` for
  the common "what code is this text?" question.

---

**Related**
- [`docs/debug/`](../debug/) — console inspector scripts (the manual fallback)
- [Development Guidelines](../development/AGENTS.md)
