---
description: Show the view this session is directed at, and what changed since its last build
---

Run `npm run view --silent` and show the output to the user.

Then, in at most three lines, say what it means for the work in hand:

- **Which family an unqualified request resolves to.** "Remove the logo" means the declared
  view's family — never a guess, never a question back to the user. If they meant another
  view, the fix is `npm run view:use <nde|nde-test|tma>`, not a different interpretation.
- **Whether the archived package is stale**, and if so whether the changes since it are in
  this family, shared by every view, or in another family.
- **Any cross-family warning**, verbatim. Uncommitted work in another family means either
  the session is pointed at the wrong view or edits landed in the wrong place — and a build
  will refuse until one of those is resolved.

Do not offer to build, switch view, or fix anything unless the user asks. This command
answers a question; it does not start work.
