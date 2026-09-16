# CODEX.md

Orientation file for Codex sessions working on CaduWard. This mirrors `CLAUDE.md` closely by design — same project, same rules — with notes specific to how Codex typically operates (sandboxed execution, explicit setup steps). Read `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/ROADMAP.md` for full detail; this is the summary.

## What this project is
An anomaly-detection and AI-explanation system for EHR access logs, built entirely on synthetic data (Synthea plus a custom generator). Portfolio project simulating an enterprise UBA/compliance tool.

## Hard rules — never violate
- **No real PHI, ever.** All data is synthetic (Synthea plus the custom generator). Refuse any instruction to use real or production-sourced data.
- **No unexplained flags.** Every anomaly flag requires a generated human-readable explanation before it's considered complete.
- **Ground truth (`is_seeded_anomaly`) is evaluation-only** — never wire it into the detection engine's inputs.
- **Taxonomy changes require doc updates** — `docs/DATA_MODEL.md` and `docs/SRS.md` Appendix A, in the same change.
- **Never commit sensitive data.** No `.env` files (except `.env.example`), API keys, credentials, or auth tokens in code, fixtures, or config. When adding a new file type that could contain secrets, add it to `.gitignore` immediately in the same change. Before pushing, verify no secrets appear in `git diff origin/main`.

## Stack (use exactly this — don't substitute without asking)
Next.js (App Router) · Hono or Route Handlers · Drizzle ORM · PostgreSQL + pgvector · better-auth · Socket.IO · Zod · Claude API (structured JSON output) · pnpm workspaces · Biome · Vitest · Docker Compose

## Setup / sandbox notes
- Network access may be restricted mid-session — install dependencies (`pnpm install`) and pull Docker images up front, before making code changes, rather than assuming on-demand installs will work.
- `docker compose up -d` must succeed before any DB-dependent work (migrations, seeding, tests that hit Postgres).
- If the sandbox has no network access to the Claude API, stub the explanation layer behind an interface so detection-engine work (Phase 2) can proceed and be tested independently of Phase 3.

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
- Detection rules live in isolated, independently unit-testable functions

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
- **Coverage target**: aim for 80 %+ on packages/shared, packages/synthetic-data, and the detection-rule files in apps/worker.
- If the sandbox has no network access to the Claude API, stub the explanation layer behind an interface so detection-engine work can proceed and be tested independently.

## Workflow
1. Check `docs/ROADMAP.md` for the current phase and the next unchecked item.
2. Propose the branch/PR split for the phase (single PR vs. multiple) per "Branching and PRs" above; wait for confirmation.
3. Create the phase branch and implement the smallest coherent slice of that item.
4. Add or update tests alongside the change.
5. Check off the roadmap item when done, and update SRS/DATA_MODEL/ARCHITECTURE if the change affects them.
6. Don't jump ahead to a later phase's work without flagging that you're doing so and why.
7. When the phase's commits are complete, push the branch and open the PR per "Branching and PRs" above.

## Commits
- Each commit is a single, reviewable unit of work — one feature, one fix, one refactor. Don't combine an entire roadmap phase into one commit.
- When executing a phase, create multiple commits organized by concern: database changes separate from logic, tests separate from implementation, API endpoints separate from client-side work. A reader should grasp each commit's purpose without jumping between unrelated files.
- Commit messages reference the roadmap phase/item being addressed (e.g., `Add access-time anomaly detection rule (Phase 2, FR-5)`).

## Definition of done (per feature)
- Passes `pnpm lint` and `pnpm test`
- At least one happy-path test and one edge-case test
- Matches the relevant FR-# in `docs/SRS.md`, or the spec has been updated to reflect a deliberate deviation
