// The map of custom element selectors -> Angular components for the `tma` family
// (VIEW_ID=TMA_NDE and VIEW_ID=TMA).
//
// Selected at build time by scripts/select-view.mjs, which re-exports this as
// `selectorComponentMap` from src/app/state/view.generated.ts. Because the unselected
// family is never imported, nothing listed in the `nde` map can reach a TMA package —
// that is the whole point of the split, not an oversight.
//
// Empty on purpose: which components TMA needs is open question 1 in
// docs/superpowers/specs/2026-09-09-per-view-isolation-design.md, and depends on Back
// Office design work that has not happened yet. A TMA build therefore registers zero
// components today, which is the correct answer until someone decides otherwise.
//
// To reuse an NDE component here, import it from ../../custom1-module/ and add a row.
// Do NOT import the `nde` map and spread it: a Map literal cannot hold two entries for
// one key, so a merged map would silently keep whichever row came last. If TMA wants a
// different component in a slot NDE already claims (e.g. 'nde-header-before'), a
// separate row here is the only way to say so.
export const map = new Map<string, any>([]);
