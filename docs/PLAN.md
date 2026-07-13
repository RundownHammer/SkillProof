# Backend Build Plan — Blockchain-Based Skill Credentialing System

Source spec: `docs/backend-architecture-flow.md` (SIH Problem 25200)
Goal: MVP, monorepo, mock-blockchain-first strategy.

---

## Rules for the agent (read this every session)

1. Work on **one phase at a time**, in order. Never start a later phase
   because "it's related" or "it's quick" — dependencies matter here.
2. Within a phase, complete steps **in order**. Each step has a `Verify`
   line — run it and confirm it passes before moving to the next step.
3. If a step can't be completed as written (missing prerequisite,
   conflicting dependency, ambiguous requirement), **stop and report it**
   instead of guessing, stubbing around it, or silently changing scope.
4. When a phase is fully done: update the **Current Status** section
   below, tick every checkbox in that phase, add a row to the
   **Progress Log**, and stop. Wait for confirmation before starting the
   next phase.
5. Do not refactor prior phases' code unless the current step explicitly
   requires it.
6. Keep the monorepo path conventions below consistent — don't invent
   new top-level folders without updating this file.

---

## Current Status

- **Active phase:** 2 — Core Database Schema
- **Active step:** not started
- **Last completed step:** 1.7

*(Update this block every time a step or phase completes. This is the
first thing to read at the start of any session.)*

---

## Monorepo Path Conventions (locked in during Phase 0)

```
apps/api/            Express REST API (producer of jobs, serves endpoints)
apps/worker/          BullMQ worker process (consumes jobs, does the work)
packages/database/    Prisma schema + shared PrismaClient
packages/shared/      Zod schemas, canonical JSON types, constants
packages/queue/        BullMQ queue + job-type definitions, shared by api + worker
packages/blockchain/  BlockchainAdapter interface, MockAdapter, RealAdapter
packages/storage/      Supabase Storage client, shared by api + worker
packages/contracts/    Hardhat + Solidity
packages/config/      shared tsconfig, ESLint config
docs/                  this file + the architecture doc
apps/*/src/env.ts      each app extends packages/shared's base envSchema
                       with its own required fields via .extend() — don't
                       add app-specific env vars to the shared schema itself
```

As each package gets created in the phase it belongs to, don't create
overlapping/duplicate packages later — check this list first.

---

## Phase 0 — Project Scaffolding

Status: `[x]` Completed

| # | Step | Verify |
|---|------|--------|
| 0.1 | Init git repo, `pnpm-workspace.yaml`, root `package.json`, `.gitignore` | `pnpm install` runs clean |
| 0.2 | Install Turborepo, `turbo.json` pipeline (build/dev/lint/typecheck/test), root scripts delegate to turbo | `pnpm turbo run build` executes with no errors |
| 0.3 | `packages/config`: base `tsconfig.base.json` (strict), shared ESLint config, root `.prettierrc` | A sample file typechecks against the base config |
| 0.4 | `packages/database`: `prisma init`, datasource + generator only (no models yet), export singleton `PrismaClient` | `prisma validate` passes |
| 0.5 | `packages/shared`: Zod schema + TS type for the canonical certificate JSON (doc §4), Zod env schema | Package builds and is importable |
| 0.6 | `apps/api`: Express + TS, single `GET /health` route, imports `database` and `shared` to prove workspace linking | `pnpm --filter api dev` boots, `curl localhost:PORT/health` → 200 |
| 0.7 | `apps/worker`: minimal process that connects to Redis, logs "worker ready" on a placeholder queue — no job logic | `pnpm --filter worker dev` connects without error |
| 0.8 | `packages/contracts`: Hardhat init, default placeholder contract | `hardhat compile` succeeds |
| 0.9 | Root `docker-compose.yml`: Postgres 16 + Redis 7 with healthchecks, `.env.example` | `docker compose up -d` → both healthy, api/worker connect |
| 0.10 | Husky + lint-staged pre-commit; GitHub Actions CI running lint/typecheck/build on PR | Bad-formatted file gets blocked/fixed on commit; CI workflow is valid |
| 0.11 | Copy architecture doc into `/docs/`, this file becomes `/docs/PLAN.md`, Phase 0 checkboxes ticked as steps land | Files exist, PLAN.md accurate |
| 0.12 |  `pnpm turbo run build lint typecheck` clean from root, commit "Phase 0: monorepo scaffold complete" | Clean git status, everything green |
| 0.13 | Final: check + commit `bash pnpm turbo run build lint typecheck ` and `bash git add -A git commit -m Phase 0: unified monorepo scaffold complete (frontend + backend, Prisma 7)` | Confirm everything is green — fix anything red before committing. |

**Do not proceed to Phase 1 until 0.13 passes.**

---

## Phase 1 — Auth & RBAC (doc §12–13)

Status: `[x]` Complete

| # | Step | Verify |
|---|------|--------|
| 1.1 | Create Clerk application, add publishable + secret keys to `apps/frontend/.env.local` and `apps/api/.env` | Keys present, neither file tracked by git |
| 1.2 | Frontend: `ClerkProvider` in root layout, `middleware.ts`, sign-in/up buttons + test-route harness on the home page | Sign up/in works via Clerk's modal |
| 1.3 | Backend: `@clerk/express` + `cors`, `apps/api/src/env.ts` extending shared schema, `clerkMiddleware()` wired | `curl` with no token → 401 |
| 1.4 | `User` model + `Role` enum in `packages/database`, migrate | `users` table exists with correct columns |
| 1.5 | Sync-on-login middleware (`syncUser`) — creates/fetches local `User` row from Clerk claims, defaults to `STUDENT` | `pnpm --filter api typecheck` clean |
| 1.6 | Wire `requireAuthenticated` + `syncUser` into a real test route, remove throwaway inline route | `curl` with no token still → 401 |
| 1.7 | `requireRole(...roles)` RBAC middleware + one test route per tier (6 roles) | 401 (no token) / 403 (wrong role) / 200 (right role) all confirmed via the frontend test page |

**Do not proceed to Phase 2 until 1.7 passes.**

---

## Phase 2 — Core Database Schema

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 2.1 | Model `Institute`, `Student`, `Qualification` in `packages/database`, migrate | Migration applies cleanly, tables exist |
| 2.2 | Model `Certificate`, `BlockchainTransaction`, `Verification`, `AuditLog` (relations only, no business logic yet) | `prisma validate` passes, relations correct |
| 2.3 | Seed script: a couple of fake institutes/students/qualifications | `pnpm --filter database seed` populates rows |
| 2.4 | CRUD service + routes in `apps/api` for Institutes and Students only (no certificates yet) | `POST/GET/PATCH/DELETE` all round-trip correctly via curl/Postman |

**Do not proceed to Phase 3 until 2.4 passes.**

---

## Phase 3 — Canonical Certificate + Hashing (no blockchain yet)

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 3.1 | Canonical JSON builder in `packages/shared` (doc §4) — pure function | Unit test: same input → same JSON, stable key order |
| 3.2 | SHA-256 hashing service in `packages/shared` — pure function | Unit test: same JSON → same hash; any field change → different hash |
| 3.3 | `POST /certificates` in `apps/api` — creates a `Certificate` row, status `queued`, no PDF/blockchain side effects yet | Row appears in Postgres with correct canonical JSON + hash stored |
| 3.4 | Regression check: hash determinism confirmed via automated test, not just manual check | Test suite passes in CI |

**Do not proceed to Phase 4 until 3.4 passes.**

---

## Phase 4 — Queue Wiring

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 4.1 | `packages/queue`: BullMQ + Redis connection setup, one throwaway test queue/worker to prove plumbing | Enqueue a test job from `apps/api`, see it consumed by `apps/worker` in logs |
| 4.2 | Create the real `certificate-issuance` queue + job payload type in `packages/queue` | Type-checked payload shared between api and worker |
| 4.3 | `POST /certificates` now enqueues a job instead of writing directly (still creates the row first, job just processes it) | Job appears in Redis/BullMQ dashboard or logs |
| 4.4 | Worker skeleton: consumes job, walks the status state machine from doc §10 (`queued → validating → hashing → blockchain_pending → generating_pdf → uploading → completed`), no real side effects yet — just status transitions + logs | Certificate row visibly transitions through all statuses in order |

**Do not proceed to Phase 5 until 4.4 passes.**

---

## Phase 5 — Blockchain Module (mock first)

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 5.1 | `packages/blockchain`: define `BlockchainAdapter` interface — `issueCertificate(id, hash)`, `getHash(id)`, `revoke(id)` | Interface compiles, no implementation yet |
| 5.2 | `MockBlockchainAdapter`: writes a fake but realistic-looking tx hash, no real chain calls | Unit test: calling it returns a deterministic-format fake hash |
| 5.3 | Wire the worker's `blockchain_pending` stage to call the adapter (mock, selected via config), store `transactionHash` on the `BlockchainTransaction` row | Row created with fake tx hash after job runs |
| 5.4 | End-to-end test: `POST /certificates` → job runs fully → status `completed` → mock tx hash stored | Full request/response cycle verified, this is your first working demo checkpoint |

**Do not proceed to Phase 6 until 5.4 passes.**

---

## Phase 6 — PDF + Storage

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 6.1 | Puppeteer service in `apps/worker`: one hardcoded English HTML template → PDF buffer | Generates a valid PDF file locally from a sample certificate |
| 6.2 | `packages/storage`: Supabase Storage client + upload/download helper | Unit test with a mocked Supabase client, or a real dev bucket |
| 6.3 | Wire into worker: after `blockchain_pending`, generate PDF, upload via `packages/storage`, store path on `Certificate` row | Certificate row has a real storage path after job runs |
| 6.4 | `GET /certificates/:id/pdf` in `apps/api` — serve/download the stored PDF | curl the endpoint, get back a valid PDF |

**Do not proceed to Phase 7 until 6.4 passes.**

---

## Phase 7 — Verification Flow (still on mock chain)

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 7.1 | `GET /verify/:certificateId` — recompute canonical JSON + hash from DB, compare against stored/adapter hash | Correct match returns `Verified` |
| 7.2 | Handle mismatch and revoked cases | Manually corrupt a DB field → response is `Tampered`; call `adapter.revoke()` → response is `Revoked` |
| 7.3 | QR code generation on issued certificates (encodes certificateId + verify URL) | QR renders and decodes to the correct URL |

**Do not proceed to Phase 8 until 7.3 passes.**

---

## Phase 8 — Real Blockchain Swap-In

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 8.1 | Minimal Solidity contract in `packages/contracts` (issue/get/exists/revoke) per doc §15 | `hardhat compile` succeeds, unit tests pass in Hardhat |
| 8.2 | Deploy to Polygon Amoy testnet, record contract address + ABI | Deployment tx confirmed on Amoy explorer |
| 8.3 | `RealBlockchainAdapter` in `packages/blockchain` using ethers.js against the deployed contract, implementing the same interface as the mock | Unit/integration test calls the real testnet contract successfully |
| 8.4 | Config flag `BLOCKCHAIN_MODE=mock\|real` selects adapter at runtime — keep the mock, don't delete it | Both modes work by flipping the env var, no code changes needed |
| 8.5 | Re-run Phase 5–7 end-to-end tests against the real adapter | Full issuance + verification cycle works against Amoy testnet |

**Do not proceed to Phase 9 until 8.5 passes.**

---

## Phase 9 — Bulk Issuance (doc §6)

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 9.1 | CSV upload endpoint in `apps/api` + Zod row validation | Invalid rows rejected with clear errors, valid rows accepted |
| 9.2 | Fan out: one `certificate-issuance` job per valid row | N rows → N jobs enqueued |
| 9.3 | Progress-tracking endpoint (counts by status) | Endpoint reflects live counts while a batch is processing |
| 9.4 | Retry/backoff config for failed jobs | Force a job to fail → confirm it retries per configured policy |

**Do not proceed to Phase 10 until 9.4 passes.**

---

## Phase 10 — Multilingual Templates (doc §9)

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 10.1 | `Translation` table keyed by `qualificationCode` + language in `packages/database` | Migration applies, seed with English + Hindi entries |
| 10.2 | Add Hindi HTML template, template-selection logic in worker by requested language | Requesting `lang=hi` produces a Hindi PDF |
| 10.3 | Regression test: hash is identical regardless of language chosen (canonical JSON never includes language) | Automated test confirms hash equality across languages for the same certificate |

**Do not proceed to Phase 11 until 10.3 passes.**

---

## Phase 11 — Admin, Audit, Hardening

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 11.1 | Admin dashboard endpoints (issuance stats, revocation) in `apps/api` | Endpoints return correct aggregate data |
| 11.2 | Audit log writes on every state-changing action | Spot-check: issuing/revoking a cert produces an `AuditLog` row |
| 11.3 | Rate limiting + input sanitization middleware | Hammering an endpoint triggers rate limit response |
| 11.4 | Swagger docs generated from existing Zod schemas | `/docs` (or configured path) renders a complete, accurate API spec |

**Do not proceed to Phase 12 until 11.4 passes.**

---

## Phase 12 — Deployment

Status: `[ ]` Not started

| # | Step | Verify |
|---|------|--------|
| 12.1 | Dockerfiles for `apps/api` and `apps/worker`, full-stack `docker-compose.yml` (api, worker, Postgres, Redis) | `docker compose up` runs the entire stack locally from images |
| 12.2 | Choose + configure deployment target (Railway/Render/Fly — confirm with project owner before this step) | Deployed services reachable at a public URL |
| 12.3 | Environment secrets checklist documented, all secrets set on the platform | No missing-env errors on deployed boot |
| 12.4 | Smoke test against the deployed URL: health check, issue a certificate, verify it | Full flow works end-to-end in the deployed environment |

**Project MVP complete when 12.4 passes.**

---

## Progress Log

| Date | Phase | Step(s) | Notes | Commit |
|------|-------|---------|-------|--------|
| 2026-07-12 | 0 | 0.1–0.13 | Manual scaffold, unified monorepo, Prisma 7 | <commit hash> |
| 2026-07-13 | 1 | 1.1–1.7 | Clerk auth + RBAC: User/Role model, sync-on-login, requireRole middleware, frontend test harness | <commit hash> |

*(Add a row every time a step or phase is completed. This is what lets a
fresh agent session pick up exactly where the last one left off.)*
