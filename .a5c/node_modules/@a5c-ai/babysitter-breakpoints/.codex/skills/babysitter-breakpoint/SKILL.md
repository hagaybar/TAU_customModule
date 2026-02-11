---
name: babysitter-breakpoint
description: Use the breakpoint API to communicate with users during babysitter runs (post breakpoints, poll for release, fetch feedback, and read context files). Trigger whenever a babysitter workflow needs approval, input, or status updates via breakpoints.
---

# babysitter-breakpoint

Use this skill to handle all user communication via the `breakpoints` CLI. Do
not prompt the user directly. Always post a breakpoint and poll until it is
released, then fetch feedback and continue.

## Workflow

1. Create a breakpoint with the required payload and `payload.context.files`.
2. Poll `breakpoints breakpoint wait <id> --interval 3` until `released`.
3. Apply feedback from the printed details and continue.

## Payload structure

Always include a `context.files` array for referenced files:

```json
{
  "context": {
    "runId": "run-...",
    "files": [
      { "path": ".a5c/runs/<runId>/artifacts/process.md", "format": "markdown" },
      { "path": ".a5c/runs/<runId>/inputs.json", "format": "code", "language": "json" },
      { "path": ".a5c/runs/<runId>/code/main.js", "format": "code", "language": "javascript" }
    ]
  }
}
```

See `references/breakpoint-api.md` for curl examples and endpoints.
