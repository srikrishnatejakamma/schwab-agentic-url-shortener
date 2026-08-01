# Scenario Coverage

## Greenfield

Purpose: demonstrate new-system delivery from requirement normalization to release readiness.

What it shows:

- requirement normalization and assumption capture
- dependency-aware decomposition
- parallel implementation tracks
- validation, documentation, and security review
- final release approval gate

Command:

```bash
npm run scenario:greenfield
```

## Brownfield

Purpose: demonstrate architectural reasoning for an enhancement against an existing system.

What it shows:

- impacted module identification
- API and data-flow reasoning
- bounded implementation changes through stable seams
- regression-focused validation and controlled release

Command:

```bash
npm run scenario:brownfield
```

## Ambiguous

Purpose: demonstrate controlled autonomy when requirements are under-specified.

What it shows:

- ambiguity detection
- safe stop before downstream execution
- human clarification request
- dynamic plan expansion with compliance review
- release approval after clarified validation

Command:

```bash
npm run scenario:ambiguous
```