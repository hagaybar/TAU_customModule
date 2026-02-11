# Breakpoint Manager

Lightweight breakpoint manager with API, queue worker, and web UI.

This package now lives at `packages/breakpoints`.

## Requirements
- Node.js 18+

## Setup
```bash
cd packages/breakpoints
npm install
npm run init:db
```

## Run (dev)
```bash
cd packages/breakpoints
npm run dev
```

## Run (installed CLI)
```bash
breakpoints start
```

Or run separately:
```bash
npm run start:api
npm run start:worker
```

## CLI Examples
Start the full system (API + web UI + worker):
```bash
breakpoints start
```

Create a breakpoint (agent):
```bash
breakpoints breakpoint create --question "Need approval?" --title "Approval"
```

Check status:
```bash
breakpoints breakpoint status <id>
```

Wait for release:
```bash
breakpoints breakpoint wait <id> --interval 3
```

Install the babysitter-breakpoint skill:
```bash
breakpoints install-skill --target codex --scope global
```

## Configuration
Environment variables:
- `PORT` (default 3185)
- `WEB_PORT` (default 3184)
- `DB_PATH` (default `~/.a5c/breakpoints/db/breakpoints.db`)
- `REPO_ROOT` (default package root / current working directory)
- `AGENT_TOKEN` (optional)
- `HUMAN_TOKEN` (optional)
- `WORKER_POLL_MS` (default 2000)
- `WORKER_BATCH_SIZE` (default 10)

## API Examples
Create breakpoint (agent):
```bash
curl -X POST http://localhost:3185/api/breakpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -d '{"agentId":"agent-1","title":"Need review","payload":{"summary":"check this"},"tags":["review"],"ttlSeconds":3600}'
```

Check status:
```bash
curl http://localhost:3185/api/breakpoints/<id>/status
```

Release with feedback (human):
```bash
curl -X POST http://localhost:3185/api/breakpoints/<id>/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HUMAN_TOKEN" \
  -d '{"author":"reviewer","comment":"Looks good","release":true}'
```

## Breakpoint Context Payload
To enable context rendering in the UI, include a `context.files` array in the
breakpoint payload:
```json
{
  "context": {
    "runId": "run-...",
    "files": [
      { "path": "docs/plan.md", "format": "markdown" },
      { "path": "api/routes.js", "format": "code", "language": "javascript" }
    ]
  }
}
```

The API serves file content via:
```
GET /api/breakpoints/:id/context?path=path/to/file
```
Only allowlisted extensions are served, and the file must be listed in the
breakpoint payload.

## Web UI
Open `http://localhost:3184` and provide the human token in the UI.

## Install the babysitter-breakpoint skill
```bash
breakpoints install-skill
```
Defaults to global Codex install. Options:
```bash
breakpoints install-skill --target codex --scope global
breakpoints install-skill --target codex --scope local
breakpoints install-skill --target claude --scope global
breakpoints install-skill --target claude --scope local
breakpoints install-skill --target cursor --scope global
breakpoints install-skill --target cursor --scope local
```
Global targets use `CODEX_HOME` or `~/.codex` for Codex, and `~/.claude` or `~/.cursor` for Claude/Cursor. Local installs write to `.codex/skills`, `.claude/skills`, or `.cursor/skills` under the package root. Restart the app after install.

When installed from npm, the skill is bundled at `.codex/skills/babysitter-breakpoint/` inside the package and copied to the target location by `breakpoints install-skill`.

## Breakpoint CLI (agent-friendly)
Create a breakpoint:
```bash
breakpoints breakpoint create \
  --question "Approve process + inputs + main.js?" \
  --run-id run-123 \
  --title "Approval needed" \
  --file ".a5c/runs/run-123/artifacts/process.md,markdown" \
  --file ".a5c/runs/run-123/inputs.json,code,json" \
  --file ".a5c/runs/run-123/code/main.js,code,javascript"
```

Wait for release (prints full details when released):
```bash
breakpoints breakpoint wait <id> --interval 3
```

## Notes
- Tags are stored as JSON in SQLite; tag filtering uses a simple string match.
- The queue worker processes TTL expiration jobs; notification jobs are stubbed.
