# NDE embedded search box — library websites

A standalone Primo NDE search box that TAU library websites can embed, so a visitor can search
the catalogue from the library's own page rather than being sent to NDE first. Built 2026-09,
handed to the website maintainers with installation instructions in English and Hebrew.

## Why there is no code here

**The materials are held internally, not in this repository.** This repository is public; the
instruction documents written for the website managers are the library's internal paperwork,
and the Ex Libris support case behind the work is not ours to publish. None of it is secret —
it simply does not belong on a public GitHub page.

They live in the private **`TAU_internal_docs`** repository, under `nde-search-box/`: the
embedded markup as handed over, the console and DevTools snippets used to demo it on a live
page before anyone committed to the change, a standalone test page, both instruction
documents, and the support-case record. The originating branch's history is archived there
too.

Ask Hagay for access if you need them.

## What is worth knowing without opening any of that

- The search box is **plain HTML** meant to be pasted into a website by someone who is not a
  developer. It is not an Angular component and it is not part of the custom package — nothing
  in `src/` builds it, and it ships on no package upload.
- **The VE → NDE redirect translates the query.** A box built against the older Primo VE URL
  shape keeps working through the redirect rather than dropping the visitor's search terms.
  This is the finding most likely to be rediscovered the expensive way.
- Because it lives on library websites rather than in this package, changing it is a
  **website-maintainer** task, not a deploy. Nothing here needs rebuilding when it changes.

## Related

- Private materials: `TAU_internal_docs` → `nde-search-box/`
- PR #55 in this repository was closed unmerged, on purpose — it existed only to review the
  materials before they were moved somewhere private.
