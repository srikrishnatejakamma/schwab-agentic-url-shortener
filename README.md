# Agentic URL Shortener Prototype

This repository implements the Schwab assignment as a runnable TypeScript prototype. It contains two cooperating parts:

1. A production-style URL shortener service with create, resolve, redirect, analytics, expiration, custom aliases, and idempotency support.
2. A governed workflow engine that models agentic SDLC execution with dependency-aware orchestration, policy gates, approval checkpoints, retries, rollback hooks, audit events, and dynamic re-planning.

## Tech Stack

- Node.js 22+
- TypeScript
- Express
- Vitest
- JSON file-backed persistence for deterministic local runs

## Quick Start

```bash
npm install
npm run build
npm test
npm run dev
```

The API starts on `http://localhost:3000` by default.

## API Surface

```text
GET    /health
GET    /api/urls
POST   /api/urls
GET    /api/urls/:code
GET    /api/urls/:code/analytics
GET    /r/:code
GET    /api/workflows
POST   /api/workflows/:scenario
```

### Example Create Request

```json
{
  "url": "https://example.com/docs",
  "customCode": "team-docs",
  "expiresInDays": 30,
  "tags": ["internal", "docs"],
  "idempotencyKey": "request-00123456"
}
```

## Scenario Demos

Each scenario writes a JSON execution artifact to `artifacts/runs/`.

```bash
npm run scenario:greenfield
npm run scenario:brownfield
npm run scenario:ambiguous
```

## Assignment Coverage

- Requirement understanding: each workflow starts with normalization and assumption capture.
- Task decomposition: workflows encode dependencies explicitly in a DAG.
- Brownfield reasoning: the brownfield scenario enumerates impacted modules, APIs, and data flow.
- Workflow orchestration: the engine supports parallel execution, synchronization, approvals, retries, fallbacks, rollback hooks, policy gates, safe stops, and audit events.
- Engineering outputs: the repo contains runnable code, tests, setup instructions, and architecture docs.
- Validation and risk control: release nodes are blocked on evidence and approval; ambiguous requirements halt until clarified.

## Limitations

- Persistence is file-backed and single-node; there is no external database or distributed locking.
- Unique requester counting is identifier-based and best-effort rather than privacy-grade identity resolution.
- Workflow nodes model SDLC execution deterministically; they do not invoke a live LLM or external agent runtime.

More detail is in [docs/architecture.md](docs/architecture.md) and [docs/scenarios.md](docs/scenarios.md).