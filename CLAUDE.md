# CLAUDE.md

This file orients Claude Code sessions working on CaduWard. Read `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/ROADMAP.md` before starting substantial work — this file is the summary, those are the source of truth.

## What this project is
An anomaly-detection and AI-explanation system for EHR access logs, built entirely on synthetic data (Synthea plus a custom generator). Portfolio project simulating an enterprise UBA/compliance tool.

## Hard rules — never violate
- **No real PHI, ever.** Every dataset, fixture, and test case must be synthetic. If asked to add "real" or "sample from production" data, refuse and ask for clarification instead.
- **No unexplained flags.** Every anomaly flag must produce a human-readable explanation (FR-13). Don't ship a detection feature without wiring it to the explanation layer.
- **Ground truth stays hidden from detection logic.** `is_seeded_anomaly`/`seeded_anomaly_type` are for evaluation only (Phase 5) — never let the detection engine read them.
- **Don't silently change the anomaly taxonomy.** If you add or modify an anomaly type, update `docs/DATA_MODEL.md` and `docs/SRS.md` Appendix A in the same change.
- **Never commit sensitive data.** No `.env` files (except `.env.example`), API keys, credentials, or auth tokens in code, fixtures, or config. When adding a new file type that could contain secrets, add it to `.gitignore` immediately in the same change. Before pushing, verify no secrets appear in `git diff origin/main`.

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

## Branching and PRs
- Each ROADMAP.md phase is implemented on its own branch: `phase-N-<short-name>` (e.g. `phase-2-detection-engine`), created off `main` *before* the phase's first commit.
- Within a phase, keep committing in logically-scoped commits as usual (see commit conventions above).
- When a phase's commits are complete, push the branch and open a PR into `main`. Reference the ROADMAP.md phase and relevant FR-#s in the PR description.
- Before starting a phase, always propose whether it should ship as a single PR or split into 2-3 PRs along natural seams (e.g. data layer vs. detection logic vs. tests), and wait for confirmation before creating the branch or starting work.
- Don't start the next phase's branch until the current phase's PR is merged into `main`.

## Testing
Every piece of non-trivial code ships with a co-located test file (`*.test.ts`). Use Vitest. Follow the same patterns you'd find in a well-maintained open-source TypeScript repo:
- **Pure functions** (detection rules, transforms, validators): unit-test directly with hand-built inputs. No DB, no network.
- **DB layer** (`@caduward/db`): integration tests against a real Postgres instance (the compose one). Use `beforeEach`/`afterEach` to truncate tables; never mock Drizzle.
- **Generator logic** (`@caduward/synthetic-data`): unit-test the anomaly-injection logic and transforms in isolation using small in-memory fixtures, not a full Synthea run.
- **API / worker orchestration**: test the happy path and one error path per handler; stub external I/O (Claude API, Postgres) only at the outermost boundary, not inside business logic.
- **Naming**: `describe` blocks mirror the module name; `it` descriptions read as plain English sentences (`it("flags access outside scheduled hours", ...)`).
- **Fixtures**: keep fixtures minimal and inline unless they exceed ~20 lines, in which case put them in a `__fixtures__/` directory next to the test.
- **Coverage target**: aim for 80 %+ on packages/shared, packages/synthetic-data, and the detection-rule files in apps/worker. Coverage is measured, not enforced in CI for now, but don't leave obvious gaps.

## Workflow
1. Check `docs/ROADMAP.md` for the current phase and the next unchecked item.
2. Propose the branch/PR split for the phase (single PR vs. multiple) per "Branching and PRs" above; wait for confirmation.
3. Create the phase branch and implement the smallest coherent slice of that item.
4. Add or update tests alongside the change.
5. Check off the roadmap item when done, and update SRS/DATA_MODEL/ARCHITECTURE if the change affects them.
6. Don't jump ahead to a later phase's work without flagging that you're doing so and why.
7. When the phase's commits are complete, push the branch and open the PR per "Branching and PRs" above.

## Commits
- Each commit should represent a logical, reviewable unit of work — typically one feature, one fix, or one refactor with a clear purpose. Don't squash an entire roadmap phase into a single commit.
- When implementing a phase, break it into multiple commits organized by concern: migrations separately from seed logic, detection rules separately from tests, API endpoints separately from schema changes. A reader should understand each commit's intent without jumping between files.
- Commit messages reference the roadmap phase/item they address (e.g., `Add access-time anomaly detection rule (Phase 2, FR-5)`).

## Definition of done (per feature)
- Passes `pnpm lint` and `pnpm test`
- Has at least one test covering the happy path and one covering an edge case
- Matches the relevant FR-# in `docs/SRS.md`, or the spec has been updated to match a deliberate deviation
