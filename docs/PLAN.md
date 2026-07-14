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

- **Active phase:** 6 — PDF + Storage
- **Active step:** not started
- **Last completed step:** 5.4

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
apps/api/src/utils/async-handler.ts   wrap every async route handler in
                                       this — reject-safety regardless of
                                       Express major version. Use for
                                       every new route from Phase 2 on.
apps/api/src/middleware/ownership.ts  requireOwnInstitute() — built for
                                       Institutes/Students but designed
                                       to be reused for Certificate
                                       routes in Phase 3 (Institute Admin
                                       should only issue certs for their
                                       own institute, same pattern).
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

Status: `[x]` Complete

| # | Step | Verify |
|---|------|--------|
| 2.1 | `Institute`, `Student`, `Qualification` models; `User.instituteId` link added | Schema edits in place, migrated together with 2.2 |
| 2.2 | `Certificate`, `BlockchainTransaction`, `Verification`, `AuditLog` (relations only); `User.auditLogs` back-relation added | `prisma validate` passes, `\dt` shows all 8 tables |
| 2.3 | Seed script (2 institutes, 2 qualifications, 3 students), idempotent via `upsert` | `pnpm --filter @credential/database seed` populates rows |
| 2.4 | Shared Zod schemas: `pagination`, `institute`, `student` in `packages/shared` | `pnpm --filter @credential/shared typecheck` clean |
| 2.5 | `asyncHandler`, Prisma not-found helper, `requireOwnInstitute` ownership middleware | `pnpm --filter api typecheck` clean |
| 2.6 | Institute CRUD — reads open to any authenticated user, writes Super/NCVET Admin only (or own-institute PATCH) | Round-trips correctly, 404 on missing id |
| 2.7 | Student CRUD — reads AND writes restricted to Super Admin/NCVET Admin/Institute Admin, ownership-scoped for Institute Admin | 403 wrong institute, 200 own institute, 404 missing id |
| 2.8 | Routes wired, global error middleware, frontend tester upgraded to general-purpose | Full E2E flow (401/403/200/404 + pagination) confirmed via frontend |

**Do not proceed to Phase 3 until 2.8 passes.**

**Do not proceed to Phase 3 until 2.4 passes.**

---

## Phase 3 — Canonical Certificate + Hashing (no blockchain yet)

Status: `[x]` Complete

| # | Step | Verify |
|---|------|--------|
| 3.1 | Canonical JSON builder in `packages/shared` (doc §4) — pure function, locked field order | Unit test: same input → same JSON, stable key order |
| 3.2 | SHA-256 hashing service in `packages/shared` — pure function | Unit test: same JSON → same hash; any field change → different hash |
| 3.3 | `POST /certificates` in `apps/api` — creates a `Certificate` row, status `QUEUED`, no PDF/blockchain side effects yet | Row appears in Postgres with correct canonical JSON + hash stored |
| 3.4 | Regression check: hash determinism confirmed via automated test, not just manual check | `pnpm --filter @credential/shared test` passes (vitest); full `build/lint/typecheck/test` green |

**Do not proceed to Phase 4 until 3.4 passes.**

Canonical field order (locked, must not change — it is the hash contract):
`certificateId, studentId, qualificationCode, credits, grade, issueDate, issuerId`.
Mappings: `studentId` → `Student.id`; `qualificationCode` → `Qualification.code`;
`issuerId` → `Institute.code` (resolved from `Certificate.instituteId`);
`issueDate` → `Certificate.issueDate` formatted `YYYY-MM-DD` (UTC). The builder
(`buildCanonicalCertificate`) and hasher (`hashCanonicalCertificate`) are pure
functions in `packages/shared` with no DB/blockchain/PDF side effects. `POST
/certificates` resolves the relations, builds canonical JSON, hashes it, and
stores `canonicalJson` + `hash` on a `QUEUED` row — no BullMQ job, PDF, or
blockchain call (those are Phases 4–5).

---

## Phase 4 — Queue Wiring

Status: `[x]` Complete

| # | Step | Verify |
|---|------|--------|
| 4.1 | `packages/queue`: BullMQ + Redis connection setup, one throwaway test queue/worker to prove plumbing | Enqueue a test job from `apps/api`, see it consumed by `apps/worker` in logs |
| 4.2 | Create the real `certificate-issuance` queue + job payload type in `packages/queue` | Type-checked payload shared between api and worker |
| 4.3 | `POST /certificates` now enqueues a job instead of writing directly (still creates the row first, job just processes it) | Job appears in Redis/BullMQ dashboard or logs |
| 4.4 | Worker skeleton: consumes job, walks the status state machine from doc §10 (`queued → validating → hashing → blockchain_pending → generating_pdf → uploading → completed`), no real side effects yet — just status transitions + logs | Certificate row visibly transitions through all statuses in order |

**Do not proceed to Phase 5 until 4.4 passes.**

---

## Phase 5 — Blockchain Module (mock first)

Status: `[x]` Complete

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

NOTE: /verify/:certificateId must be PUBLIC — no auth required.
Confirmed with project owner: anyone scanning a certificate's QR code
needs to see Verified/Tampered/Revoked without logging in. This is a
deliberate, single exception to the "everything requires auth" pattern
established in Phases 1–2 — don't accidentally wrap it in
requireAuthenticated when building Phase 7.

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
| 2026-07-14 | 2 | 2.1–2.8 | Core schema (Institute/Student/Qualification/Certificate/BlockchainTx/Verification/AuditLog), ownership-scoped Institute+Student CRUD, shared Zod schemas, seed; full E2E (401/403/200/404 + pagination) verified via automated Clerk-token flow | <commit hash> |
| 2026-07-14 | 3 | 3.1–3.4 | Canonical certificate JSON builder + SHA-256 hasher (pure fns in shared), `POST /certificates` creates QUEUED row storing canonicalJson+hash with ownership/role gating; vitest unit tests (12 functional E2E checks) green | <commit hash> |
| 2026-07-14 | 4 | 4.1–4.4 | New `@credential/queue` package (BullMQ factory, queue `certificate-issuance`, job payload `{ certificateId }` = Certificate Prisma `id`); 4.1 throwaway enqueue→consume smoke test; `POST /certificates` enqueues job after row creation (enqueue failure leaves row QUEUED + logs); worker walks status state machine (QUEUED→…→COMPLETED) idempotently | <pending> |
| 2026-07-14 | 5 | 5.1–5.4 | New `@credential/blockchain` package: `BlockchainAdapter` interface + `MockBlockchainAdapter` (0x+64-hex, in-memory map) + `getBlockchainAdapter()` seam (mock only; `BLOCKCHAIN_MODE` switch deferred to Phase 8); worker `blockchain_pending` stage calls adapter and writes `BlockchainTransaction` row (CONFIRMED, network `mock`); automated E2E proves full flow → `completed` + tx row | <pending> |

*(Add a row every time a step or phase is completed. This is what lets a
fresh agent session pick up exactly where the last one left off.)*
