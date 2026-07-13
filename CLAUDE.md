# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Skill Credentialing System** — A blockchain-based platform for issuing, storing, and verifying vocational skill certificates. Built for SIH Problem Statement 25200 (NCVET).

**Architecture**: Certificates are issued as canonical JSON, hashed (SHA-256), and the hash is anchored on-chain (Polygon) for tamper-proof verification. Actual certificate data, PDFs, and metadata live off-chain in Postgres and Supabase Storage.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15 (App Router) + Clerk auth |
| API | Express + TypeScript |
| Background Jobs | BullMQ + Redis |
| Database | PostgreSQL 16 + Prisma ORM 7 (driver adapter pattern) |
| Object Storage | Supabase Storage (Phase 6+) |
| Blockchain | Polygon + Solidity/Hardhat (mocked until Phase 8) |
| Validation | Zod |

---

## Repo Structure

```
apps/
  api/         Express REST API (port 4000)
  frontend/    Next.js app (port 3000)
  worker/      BullMQ worker process
packages/
  config/      Shared tsconfig + ESLint config
  shared/      Zod schemas, canonical certificate types, env schema (frontend-safe)
  database/    Prisma schema + client (Prisma 7, driver adapter pattern)
  contracts/   Hardhat + Solidity contracts
  queue/       (Phase 4+) BullMQ queue + job types shared by api + worker
  blockchain/  (Phase 5+) BlockchainAdapter interface, Mock/Real adapters
  storage/     (Phase 6+) Supabase Storage client
docs/
  PLAN.md              Phase-by-phase build plan + progress log
  backend-architecture-flow.md  Architecture & design rationale
docker-compose.yml     Local Postgres 16 + Redis 7
```

Internal packages are scoped as `@credential/*` (e.g. `@credential/shared`) and linked via `workspace:*`.

---

## Prerequisites

- Node.js 22
- pnpm (`npm install -g pnpm`)
- Docker Desktop running

---

## Setup

```bash
# Install dependencies
pnpm install

# Copy env files (each app/package only needs its subset — see .env.example)
cp .env.example .env
cp .env.example packages/database/.env
cp .env.example apps/api/.env
cp .env.example apps/worker/.env

# Start local infra
docker compose up -d
docker compose ps  # both postgres and redis should show "healthy"

# Generate Prisma client & validate schema
pnpm --filter @credential/database validate
pnpm --filter @credential/database generate

# Approve Prisma's install script (one-time after fresh clone)
pnpm approve-builds
```

---

## Common Commands

### Run Development Servers

```bash
# API (http://localhost:4000/health)
pnpm --filter api dev

# Worker (logs "worker ready")
pnpm --filter worker dev

# Frontend (http://localhost:3000)
pnpm --filter frontend dev
```

### Monorepo Operations (run from root)

```bash
# Build all packages
pnpm turbo run build

# Lint all packages
pnpm turbo run lint

# Typecheck all packages
pnpm turbo run typecheck

# Run tests (when implemented)
pnpm turbo run test

# Clean all build outputs
pnpm turbo run clean

# Database operations
pnpm --filter @credential/database migrate dev
pnpm --filter @credential/database studio  # Prisma Studio
```

### Package-Specific Commands

```bash
# API
pnpm --filter api dev        # dev server with tsx watch
pnpm --filter api build      # tsc
pnpm --filter api lint       # eslint
pnpm --filter api typecheck  # tsc --noEmit

# Worker
pnpm --filter worker dev     # tsx watch
pnpm --filter worker build   # tsc

# Frontend
pnpm --filter frontend dev   # next dev --port 3000
pnpm --filter frontend build # next build

# Database
pnpm --filter @credential/database generate  # prisma generate
pnpm --filter @credential/database migrate   # prisma migrate dev
pnpm --filter @credential/database studio    # prisma studio

# Contracts (in packages/contracts)
npx hardhat compile
npx hardhat test
npx hardhat test solidity
npx hardhat test mocha
```

---

## Environment Variables

Each package only needs a subset. See `.env.example` for full list.

| Variable | Required By | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | api, worker, database | Postgres connection string |
| `REDIS_URL` | api, worker | Redis connection string |
| `PORT` | api | API server port (default 3001) |
| `CLERK_SECRET_KEY` | api | Clerk secret key |
| `FRONTEND_URL` | api | CORS origin (default http://localhost:3000) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend | Clerk publishable key |
| `NEXT_PUBLIC_API_URL` | frontend | API base URL (default http://localhost:4000) |
| `BLOCKCHAIN_MODE` | worker | `mock` or `real` (default: mock) |

---

## Development Workflow

1. **Check `docs/PLAN.md` Current Status** — The "Current Status" block at the top shows the active phase and step.
2. **Work through the phase's steps in order** — Each step has a `Verify` criterion; run it and confirm it passes before moving on.
3. **When a phase completes** — Tick its checkboxes, update **Current Status**, add a row to **Progress Log**, commit.
4. **Do not start a later phase early** — Dependencies between phases matter more than they appear.

---

## Key Architecture Notes

### Prisma 7 Driver Adapter Pattern
`packages/database` uses `@prisma/adapter-pg` with a shared `PrismaClient` singleton exported from `src/index.ts`. Other packages import it as:
```typescript
import { prisma } from "@credential/database";
```

### Canonical Certificate (packages/shared)
The canonical JSON schema (`canonicalCertificateSchema`) in `packages/shared/src/certificate.ts` is the **single source of truth** for what gets hashed. Only this JSON is hashed (SHA-256); PDFs and translations are derived artifacts.

### Auth (Clerk)
- API: `@clerk/express` middleware on protected routes
- Frontend: `@clerk/nextjs` with `<ClerkProvider>` in root layout
- RBAC middleware (`requireRole`) to be implemented in Phase 1

### Background Jobs (BullMQ)
- Queue definitions live in `packages/queue` (Phase 4+)
- Worker (`apps/worker`) consumes jobs; API (`apps/api`) produces them
- Job status state machine (Phase 4): `queued → validating → hashing → blockchain_pending → generating_pdf → uploading → completed`

### Blockchain (Mocked until Phase 8)
- Interface: `BlockchainAdapter` with `issueCertificate(id, hash)`, `getHash(id)`, `revoke(id)`
- `MockBlockchainAdapter` returns deterministic fake tx hashes
- `RealBlockchainAdapter` (Phase 8) uses ethers.js against deployed Polygon contract
- Controlled by `BLOCKCHAIN_MODE=mock|real` env var

---

## Testing

- No test framework configured yet (Phase 0 only)
- Each package has a `test` script placeholder
- When adding tests, follow the monorepo pattern: `pnpm turbo run test`

---

## Git Workflow

- Main branch: `master`
- Commit messages follow the phase log format in `docs/PLAN.md`
- Pre-commit: Husky + lint-staged (runs lint/typecheck on staged files)

---

## Useful Files to Reference

- `docs/PLAN.md` — Phase-by-phase plan with verify steps and current status
- `docs/backend-architecture-flow.md` — Full architecture rationale
- `packages/shared/src/certificate.ts` — Canonical certificate schema
- `packages/shared/src/env.ts` — Shared Zod env schema
- `packages/database/prisma/schema.prisma` — Database schema
- `apps/api/src/env.ts` — API-specific env validation
- `apps/api/src/index.ts` — Express app entry point
- `apps/worker/src/index.ts` — Worker entry point (BullMQ setup)

---

## Notes for Future Sessions

- **Phase 0 is complete** (monorepo scaffold, Prisma 7, Clerk integration in API/frontend, Docker infra). Current status: **Phase 1 — Auth & RBAC, not started**.
- The frontend currently has a test page at `/` that exercises protected API routes via Clerk tokens.
- Prisma client is generated to `packages/database/src/generated/prisma` (see `prisma.config.ts`).
- When adding new packages, follow the `@credential/*` namespace and add to `pnpm-workspace.yaml` if needed.

---

## Running a Quick Health Check

```bash
# Start infra
docker compose up -d

# Start API
pnpm --filter api dev &
# Wait for "api listening on port 4000"
curl http://localhost:4000/health
# {"status":"ok","service":"api","prismaClientLoaded":true}

# Start worker
pnpm --filter worker dev &
# Wait for "worker ready"
```

---

*Generated from codebase analysis on 2026-07-13. Update this file when architecture changes significantly.*