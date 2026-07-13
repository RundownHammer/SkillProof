# Skill Credentialing System

A blockchain-based platform for issuing, storing, and verifying vocational
skill certificates. Built for SIH Problem Statement 25200 (NCVET).

Certificates are issued as canonical JSON, hashed (SHA-256), and the hash
is anchored on-chain (Polygon) for tamper-proof verification — while the
actual certificate data, PDFs, and metadata live off-chain in Postgres and
Supabase Storage. See [`docs/backend-architecture-flow.md`](docs/backend-architecture-flow.md)
for the full architecture rationale.

---

## Status

### Backend 
**Phase 0 — Project Scaffolding ✅ Complete**

**Phase 1 — Auth & RBAC: ✅ Complete**

Next up: **Phase 2 — Core Database Schema.**

### Frontend 
Haven't started yet :)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js (App Router) + Clerk |
| API | Express + TypeScript |
| Background jobs | BullMQ + Redis |
| Database | PostgreSQL 16 + Prisma ORM 7 |
| Object storage | Supabase Storage *(arriving Phase 6)* |
| Blockchain | Polygon + Solidity/Hardhat *(mocked until Phase 8)* |
| Validation | Zod |

---

## Repo Structure

```
apps/
  frontend/    Next.js app
  api/         Express REST API
  worker/      BullMQ worker process
packages/
  config/      shared tsconfig + ESLint config
  shared/      Zod schemas, canonical certificate types — frontend-safe
  database/    Prisma schema + client (Prisma 7, driver adapter pattern)
  contracts/   Hardhat + Solidity
docs/
  backend-architecture-flow.md   architecture & design rationale
  PLAN.md                        phase-by-phase build plan + progress log
docker-compose.yml   local Postgres 16 + Redis 7
```

Internal packages are scoped as `@credential/*` (e.g. `@credential/shared`)
and linked via `workspace:*` — not published anywhere, just a local
namespace so imports read cleanly across packages.

## Conventions

- **App env files:** each `apps/*/src/env.ts` extends `@credential/shared`'s
  base `envSchema` with its own required fields via `.extend()` — app-specific
  env vars belong in the app's env file, never the shared schema.

---

## Prerequisites

- Node.js 22
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running

---

## Setup

```bash
git clone https://github.com/RundownHammer/SkillProof.git
cd credential-system
pnpm install
```

Copy env files (see `.env.example` for what each variable is for and
which app/package reads it):
```bash
cp .env.example .env
cp .env.example packages/database/.env
cp .env.example apps/api/.env
cp .env.example apps/worker/.env
```
Then fill in each copy with the values that file actually needs — not
every package needs every variable; `.env.example` documents which is
which.

Start local infra:
```bash
docker compose up -d
docker compose ps      # both postgres and redis should show "healthy"
```

Generate the Prisma client and confirm the schema is valid:
```bash
pnpm --filter @credential/database validate
pnpm --filter @credential/database generate
```

Approve Prisma's install script (one-time, only needed after a fresh
clone/install):
```bash
pnpm approve-builds
```

Run everything:
```bash
pnpm --filter api dev        # http://localhost:4000/health
pnpm --filter worker dev     # logs "redis connected" then "worker ready"
pnpm --filter frontend dev   # http://localhost:3000
```

Or run the full monorepo build/lint/typecheck at once:
```bash
pnpm turbo run build lint typecheck
```

---

## Common Commands

```bash
pnpm --filter <package> dev          # run one package's dev server
pnpm --filter <package> <script>     # run any script scoped to one package
pnpm turbo run build lint typecheck  # run across the whole workspace
pnpm --filter @credential/database studio   # Prisma Studio (DB browser)
docker compose logs -f <service>     # tail postgres/redis logs
docker compose down                  # stop containers, keep data
docker compose down -v               # stop containers, wipe data volume
```

Package names above match each `package.json`'s `"name"` field —
`api`, `worker`, `frontend`, `@credential/database`, `@credential/shared`,
`@credential/config`.

---

## Verifying Everything Is Healthy

Beyond "it started without crashing" — a fuller checklist (container
versions, port conflicts, live wiring between every pair of services,
CI status) lives at the end of the Phase 0 setup guide. Worth running
after a reboot, after fixing an environment issue, or before starting a
new phase, not just once at the very beginning.

---

## Development Workflow

1. Check `docs/PLAN.md`'s **Current Status** block for the active phase.
2. Work through that phase's steps in order — each has a `Verify` step;
   don't move to the next step until it passes.
3. When a phase completes: tick its checkboxes, update **Current
   Status**, add a row to the **Progress Log**, commit.
4. Don't start a later phase early, even if it looks quick or related —
   dependencies between phases matter more than they look at a glance.
