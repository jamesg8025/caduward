# CLAUDE.md

This file orients Claude Code sessions working on CaduWard. Read `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/ROADMAP.md` before starting substantial work — this file is the summary, those are the source of truth.

## What this project is
An anomaly-detection and AI-explanation system for EHR access logs, built entirely on synthetic data (Synthea plus a custom generator). Portfolio project simulating an enterprise UBA/compliance tool.

## Hard rules — never violate
- **No real PHI, ever.** Every dataset, fixture, and test case must be synthetic. If asked to add "real" or "sample from production" data, refuse and ask for clarification instead.
- **No unexplained flags.** Every anomaly flag must produce a human-readable explanation (FR-13). Don't ship a detection feature without wiring it to the explanation layer.
- **Ground truth stays hidden from detection logic.** `is_seeded_anomaly`/`seeded_anomaly_type` are for evaluation only (Phase 5) — never let the detection engine read them.
- **Don't silently change the anomaly taxonomy.** If you add or modify an anomaly type, update `docs/DATA_MODEL.md` and `docs/SRS.md` Appendix A in the same change.

## Stack (use exactly this — don't substitute without asking)
Next.js (App Router) · Hono or Route Handlers · Drizzle ORM · PostgreSQL + pgvector · better-auth · Socket.IO · Zod · Claude API (structured JSON output) · pnpm workspaces · Biome · Vitest · Docker Compose

## Commands
```
pnpm install
docker compose up -d
pnpm --filter synthetic-data generate
pnpm --filter db migrate
pnpm dev
pnpm test
pnpm lint
```

## Conventions
- Naming: `CaduWard` in display contexts (README, UI, docs); `caduward` (all lowercase) in package.json `name` fields, the docker-compose project name, and repo/directory names; scoped packages as `@caduward/<app-or-package>`; env vars prefixed `CADUWARD_`
- TypeScript strict mode everywhere
- Validate every external boundary (API input, LLM output, generator config) with Zod
- All DB access through Drizzle — no raw SQL outside migration files
- Detection rules live in isolated, independently unit-testable functions (one file per rule or a clear rule registry) — see `ARCHITECTURE.md`
- Commit messages reference the roadmap phase/item they address, when applicable

## Workflow
1. Check `docs/ROADMAP.md` for the current phase and the next unchecked item.
2. Implement the smallest coherent slice of that item.
3. Add or update tests alongside the change.
4. Check off the roadmap item when done, and update SRS/DATA_MODEL/ARCHITECTURE if the change affects them.
5. Don't jump ahead to a later phase's work without flagging that you're doing so and why.

## Definition of done (per feature)
- Passes `pnpm lint` and `pnpm test`
- Has at least one test covering the happy path and one covering an edge case
- Matches the relevant FR-# in `docs/SRS.md`, or the spec has been updated to match a deliberate deviation
