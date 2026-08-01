# Architecture Overview

## Components

- `src/app.ts`: HTTP entrypoint and request validation.
- `src/domain/urlShortenerService.ts`: business logic for creation, resolution, expiration, analytics, and idempotency.
- `src/storage/fileUrlRepository.ts`: file-backed persistence layer.
- `src/orchestration/workflowEngine.ts`: dependency-graph execution engine with governance controls.
- `src/scenarios/catalog.ts`: greenfield, brownfield, and ambiguous workflow definitions.
- `src/scenarios/runScenario.ts`: CLI runner that executes scenarios and writes audit artifacts.

## URL Shortener Control Flow

1. API requests are validated with Zod.
2. The domain service applies creation or resolution rules.
3. The repository persists records to `data/urls.json`.
4. Analytics are updated on each resolve/redirect.

## Orchestration Model

The workflow engine is the critical differentiator for the assignment.

- Explicit dependency graph: each workflow node declares `dependsOn`.
- Sequential and parallel execution: ready nodes in the same frontier execute concurrently.
- Entry/exit governance: nodes can require approval and named policy checks.
- Stateful context: artifacts, decisions, approvals, metrics, and audit events live in a shared execution context.
- Reliability controls: retries, fallback handlers, rollback hooks, and safe-stop status are first-class behaviors.
- Human oversight: high-impact nodes such as `release-readiness` require explicit approval.
- Dynamic re-planning: nodes may inject new nodes at runtime when upstream outcomes change.

## Traceability and Metrics

Each run produces:

- artifact outputs by node
- decision lineage entries
- audit events with timestamps and node references
- metrics for success rate, retries, rollback count, MTTR, and end-to-end latency

## Risk Controls

- Ambiguous requirements block downstream execution until clarified.
- Release readiness is gated on validation evidence and security-review evidence.
- Expired links return `410 Gone` instead of silently redirecting.
- Idempotency keys prevent accidental duplicate short-link creation.