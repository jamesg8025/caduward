# Build Roadmap — CaduWard

Phased so an agent (or you) can work through this incrementally and always have something runnable at the end of each phase. Check items off as they're completed.

## Phase 0 — Scaffold
- [x] Initialize pnpm workspace (`apps/web`, `apps/worker`, `packages/db`, `packages/synthetic-data`, `packages/shared`)
- [x] Apply the naming convention below to every `package.json` `name` field, the `docker-compose.yml` project name, and any env var prefixes
- [x] Biome config, Vitest config, base tsconfig
- [x] `docker-compose.yml`: postgres (pgvector image), redis
- [x] Drizzle config pointed at the compose Postgres instance

### Naming convention
| Context | Form |
|---|---|
| Display name (README, UI, docs) | `CaduWard` |
| Package/repo/compose names | `caduward` (all lowercase) |
| Scoped package names (if used) | `@caduward/web`, `@caduward/worker`, `@caduward/db`, etc. |
| Env var prefix | `CADUWARD_` |

## Phase 1 — Synthetic data pipeline
- [x] Wire up Synthea (Docker image or local JAR) to produce a FHIR bundle
- [x] Write the FHIR → `patients`/`encounters` transform
- [x] Build the `staff` generator (config-driven)
- [x] Build the `access_events` generator with the anomaly injector (see `DATA_MODEL.md` config shape)
- [x] Seed script: `pnpm --filter synthetic-data generate` produces a full reproducible dataset

## Phase 2 — Detection engine
- [x] Implement rule-based checks (FR-6 to FR-10) as isolated, independently testable functions
- [x] Compute `role_baselines` embeddings, store in pgvector
- [x] Implement the similarity-deviation check (FR-11)
- [x] Write `anomaly_flags` from a detection pass over `access_events`
- [x] Unit tests per rule using small hand-built fixtures (not the full generator) for clarity

## Phase 3 — Claude explanation layer
- [x] Define the Zod schema for `{summary, contributing_factors, recommended_action}`
- [x] Write the prompt template (fixed structure, few-shot if needed)
- [x] Call the Claude API per flag, validate output against schema, retry on schema failure
- [x] Persist to `flag_explanations`
- [x] (Optional) Ollama provider toggle for the on-prem story

## Phase 4 — Dashboard
- [x] better-auth setup, Admin/Reviewer roles
- [x] Flag list view (server-rendered, sorted by severity)
- [x] Flag detail view (explanation plus raw contributing data)
- [x] Review-status actions (reviewed/escalated/dismissed)
- [x] Socket.IO live push for new flags

## Phase 5 — Evaluation & polish
- [ ] Evaluation script: precision/recall/F1 against `is_seeded_anomaly` ground truth
- [ ] Metrics view in the dashboard
- [ ] README polish, demo script/walkthrough
- [ ] (Optional) deploy demo instance
