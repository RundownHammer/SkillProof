# Phase 2 — Core Database Schema Manual Setup Guide (Copy-Paste Edition)

Covers `docs/PLAN.md` Phase 2, revised per your answers: ownership-scoped
RBAC for Institute Admins, pagination on list endpoints, reads locked
down by role (not just auth). Do steps in order; every step ends with a
`Verify`.

## Prerequisites

- Phase 1 complete and passing its sanity check
- Docker containers running: `docker compose up -d`
- You have a real Clerk account signed in via `localhost:3000` from Phase 1

---

## Step 2.1 — Institute, Student, Qualification + User↔Institute link

Edit `packages/database/prisma/schema.prisma` — append below what's there:
```prisma
model Institute {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  state     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  students     Student[]
  certificates Certificate[]
  admins       User[]

  @@map("institutes")
}

model Student {
  id          String   @id @default(cuid())
  fullName    String
  email       String   @unique
  phone       String?
  instituteId String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  institute    Institute     @relation(fields: [instituteId], references: [id], onDelete: Restrict)
  certificates Certificate[]

  @@index([instituteId])
  @@map("students")
}

model Qualification {
  id        String   @id @default(cuid())
  code      String   @unique
  title     String
  nsqfLevel Int?
  credits   Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  certificates Certificate[]

  @@map("qualifications")
}
```

Now edit the **existing** `User` model (from Phase 1) — add these two
fields inside it (don't touch anything else in that model yet):
```prisma
  instituteId String?

  institute Institute? @relation(fields: [instituteId], references: [id], onDelete: SetNull)
```
`instituteId` is optional — only Institute Admins meaningfully have one;
every other role leaves it `null`. `onDelete: SetNull` means deleting an
institute un-assigns its admins rather than failing outright.

(`Certificate` is referenced above but doesn't exist until Step 2.2 —
that's expected, Prisma will complain if you try to migrate now. Do
Step 2.2's schema edits *before* migrating, or migrate twice — either
works, but doing 2.2 first avoids an intermediate broken state. If
you'd rather migrate incrementally to catch mistakes early, skip ahead,
add just the `Certificate` model's shell from 2.2, migrate here, then
continue.)

We'll migrate once both 2.1 and 2.2's models are in place — see the
combined verify at the end of Step 2.2.

---

## Step 2.2 — Certificate, BlockchainTransaction, Verification, AuditLog

Append to the same `schema.prisma`:
```prisma
enum CertificateStatus {
  QUEUED
  VALIDATING
  HASHING
  BLOCKCHAIN_PENDING
  GENERATING_PDF
  UPLOADING
  COMPLETED
  FAILED
}

enum VerificationResult {
  VERIFIED
  TAMPERED
  REVOKED
}

enum BlockchainTxStatus {
  PENDING
  CONFIRMED
  FAILED
}

model Certificate {
  id              String            @id @default(cuid())
  certificateId   String            @unique
  studentId       String
  qualificationId String
  instituteId     String
  credits         Int
  grade           String
  issueDate       DateTime
  status          CertificateStatus @default(QUEUED)
  extraFields     Json?
  canonicalJson   Json?
  hash            String?
  pdfUrl          String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  student       Student                @relation(fields: [studentId], references: [id], onDelete: Restrict)
  qualification Qualification          @relation(fields: [qualificationId], references: [id], onDelete: Restrict)
  institute     Institute              @relation(fields: [instituteId], references: [id], onDelete: Restrict)
  blockchainTx  BlockchainTransaction?
  verifications Verification[]

  @@index([studentId])
  @@index([instituteId])
  @@map("certificates")
}

model BlockchainTransaction {
  id              String             @id @default(cuid())
  certificateId   String             @unique
  transactionHash String?
  network         String             @default("mock")
  status          BlockchainTxStatus @default(PENDING)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  certificate Certificate @relation(fields: [certificateId], references: [id], onDelete: Cascade)

  @@map("blockchain_transactions")
}

model Verification {
  id            String             @id @default(cuid())
  certificateId String
  result        VerificationResult
  verifierIp    String?
  verifiedAt    DateTime           @default(now())

  certificate Certificate @relation(fields: [certificateId], references: [id], onDelete: Cascade)

  @@index([certificateId])
  @@map("verifications")
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

Edit the `User` model again — add one more field (now that `AuditLog`
exists to reference):
```prisma
  auditLogs AuditLog[]
```

Fields on `Certificate`/`BlockchainTransaction`/etc. beyond relations
(`hash`, `pdfUrl`, `status` transitions) sit unused until Phase 3+ — per
the original plan, this step is relations-only, no business logic yet.

**Verify (covers both 2.1 and 2.2):**
```bash
pnpm --filter @credential/database migrate -- --name add_core_schema
pnpm --filter @credential/database generate
pnpm --filter @credential/database validate
```
```bash
docker compose exec postgres psql -U credential -d credential_dev -c "\dt"
```
Should list `users`, `institutes`, `students`, `qualifications`,
`certificates`, `blockchain_transactions`, `verifications`, `audit_logs`.

---

## Step 2.3 — Seed script

```bash
pnpm add -D --filter @credential/database tsx@latest
```

Add to `packages/database/package.json`'s `"scripts"`:
```json
"seed": "tsx prisma/seed.ts"
```

Create `packages/database/prisma/seed.ts`:
```ts
import { prisma } from "../src/client.js";

async function main() {
  const institute1 = await prisma.institute.upsert({
    where: { code: "INST-DEL-001" },
    update: {},
    create: { name: "Delhi Skill Development Institute", code: "INST-DEL-001", state: "Delhi" },
  });

  const institute2 = await prisma.institute.upsert({
    where: { code: "INST-MUM-001" },
    update: {},
    create: { name: "Mumbai Vocational Training Center", code: "INST-MUM-001", state: "Maharashtra" },
  });

  await prisma.qualification.upsert({
    where: { code: "QF102" },
    update: {},
    create: { code: "QF102", title: "Assistant Electrician", nsqfLevel: 3, credits: 24 },
  });

  await prisma.qualification.upsert({
    where: { code: "QF210" },
    update: {},
    create: { code: "QF210", title: "Junior Software Developer", nsqfLevel: 4, credits: 36 },
  });

  await prisma.student.upsert({
    where: { email: "asha.verma@example.com" },
    update: {},
    create: { fullName: "Asha Verma", email: "asha.verma@example.com", phone: "9999900001", instituteId: institute1.id },
  });

  await prisma.student.upsert({
    where: { email: "ravi.kumar@example.com" },
    update: {},
    create: { fullName: "Ravi Kumar", email: "ravi.kumar@example.com", phone: "9999900002", instituteId: institute1.id },
  });

  await prisma.student.upsert({
    where: { email: "priya.singh@example.com" },
    update: {},
    create: { fullName: "Priya Singh", email: "priya.singh@example.com", phone: "9999900003", instituteId: institute2.id },
  });

  console.log("Seed complete:", { institute1: institute1.id, institute2: institute2.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```
Uses `upsert` throughout so re-running is safe — won't create duplicates
if you seed twice.

**Verify:**
```bash
pnpm --filter @credential/database seed
```
Logs `Seed complete` with two institute IDs — **copy `institute1`'s ID
somewhere, you'll need it in Step 2.8.**

---

## Step 2.4 — Shared Zod schemas

Create `packages/shared/src/pagination.ts`:
```ts
import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```

Create `packages/shared/src/institute.ts`:
```ts
import { z } from "zod";

export const instituteCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  state: z.string().optional(),
});

export const instituteUpdateSchema = instituteCreateSchema.partial();

export type InstituteCreateInput = z.infer<typeof instituteCreateSchema>;
export type InstituteUpdateInput = z.infer<typeof instituteUpdateSchema>;
```

Create `packages/shared/src/student.ts`:
```ts
import { z } from "zod";

export const studentCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  instituteId: z.string().min(1),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
```

Update `packages/shared/src/index.ts`:
```ts
export * from "./certificate.js";
export * from "./env.js";
export * from "./pagination.js";
export * from "./institute.js";
export * from "./student.js";
```

**Verify:**
```bash
pnpm --filter @credential/shared typecheck
```

---

## Step 2.5 — asyncHandler, global error middleware, ownership middleware

Create `apps/api/src/utils/async-handler.ts` — wraps every async route
handler so a rejected promise reaches Express's error handling reliably,
regardless of Express major version:
```ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
```

Create `apps/api/src/utils/prisma-errors.ts`:
```ts
import { Prisma } from "@credential/database";

export function isPrismaNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}
```

Create `apps/api/src/middleware/ownership.ts` — this is the piece that
implements your "own institute only" answer. Designed to be reused
beyond Institutes/Students — Phase 3's certificate issuance will need
the same "Institute Admin can only act on their own institute" logic:
```ts
import type { Request, Response, NextFunction } from "express";
import { prisma } from "@credential/database";

export function requireOwnInstitute(
  getTargetInstituteId: (req: Request) => Promise<string | null>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.dbUser.role === "SUPER_ADMIN" || req.dbUser.role === "NCVET_ADMIN") {
      return next();
    }

    if (req.dbUser.role !== "INSTITUTE_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!req.dbUser.instituteId) {
      return res.status(403).json({ error: "Institute Admin has no institute assigned" });
    }

    const targetInstituteId = await getTargetInstituteId(req);

    if (!targetInstituteId || targetInstituteId !== req.dbUser.instituteId) {
      return res.status(403).json({ error: "Forbidden — not your institute" });
    }

    next();
  };
}

export async function instituteIdFromParam(req: Request): Promise<string | null> {
  return req.params.id ?? null;
}

export async function studentInstituteFromBody(req: Request): Promise<string | null> {
  return typeof req.body?.instituteId === "string" ? req.body.instituteId : null;
}

export async function studentInstituteFromExisting(req: Request): Promise<string | null> {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  return student?.instituteId ?? null;
}
```

**Verify:**
```bash
pnpm --filter api typecheck
```

---

## Step 2.6 — Institute CRUD routes

Create `apps/api/src/routes/institutes.ts`:
```ts
import { Router } from "express";
import { prisma } from "@credential/database";
import { instituteCreateSchema, instituteUpdateSchema, paginationQuerySchema } from "@credential/shared";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import { requireOwnInstitute, instituteIdFromParam } from "../middleware/ownership.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isPrismaNotFoundError } from "../utils/prisma-errors.js";

const router = Router();

router.use(requireAuthenticated, syncUser);

// Any authenticated user can read — no privacy concern at the institute level.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = paginationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid pagination params" });
    }
    const { page, limit } = parsed.data;

    const [data, total] = await Promise.all([
      prisma.institute.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.institute.count(),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const institute = await prisma.institute.findUnique({ where: { id: req.params.id } });
    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }
    res.status(200).json(institute);
  }),
);

router.post(
  "/",
  requireRole("SUPER_ADMIN", "NCVET_ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = instituteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const institute = await prisma.institute.create({ data: parsed.data });
    res.status(201).json(institute);
  }),
);

router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "NCVET_ADMIN", "INSTITUTE_ADMIN"),
  requireOwnInstitute(instituteIdFromParam),
  asyncHandler(async (req, res) => {
    const parsed = instituteUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    try {
      const institute = await prisma.institute.update({ where: { id: req.params.id }, data: parsed.data });
      res.status(200).json(institute);
    } catch (err) {
      if (isPrismaNotFoundError(err)) {
        return res.status(404).json({ error: "Institute not found" });
      }
      throw err;
    }
  }),
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "NCVET_ADMIN"),
  asyncHandler(async (req, res) => {
    try {
      await prisma.institute.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      if (isPrismaNotFoundError(err)) {
        return res.status(404).json({ error: "Institute not found" });
      }
      throw err;
    }
  }),
);

export default router;
```

Institute deletion is deliberately Super Admin/NCVET Admin only, even
for the institute's own admin — deleting an institute is a rare
regulatory action, not routine self-service, and it's blocked outright
(`onDelete: Restrict`) while any students still reference it.

**Verify:** `pnpm --filter api typecheck` clean. Full functional verify comes in Step 2.8.

---

## Step 2.7 — Student CRUD routes

Create `apps/api/src/routes/students.ts`:
```ts
import { Router } from "express";
import { prisma } from "@credential/database";
import { studentCreateSchema, studentUpdateSchema, paginationQuerySchema } from "@credential/shared";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import { requireOwnInstitute, studentInstituteFromBody, studentInstituteFromExisting } from "../middleware/ownership.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isPrismaNotFoundError } from "../utils/prisma-errors.js";

const router = Router();

router.use(requireAuthenticated, syncUser);

const canAccessStudents = requireRole("SUPER_ADMIN", "NCVET_ADMIN", "INSTITUTE_ADMIN");

// List — Super Admin/NCVET Admin see everyone, Institute Admin sees only their own institute.
// Student/Employer/Verifier get 403 here — no browsing the student roster.
router.get(
  "/",
  canAccessStudents,
  asyncHandler(async (req, res) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = paginationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid pagination params" });
    }
    const { page, limit } = parsed.data;

    let where = {};
    if (req.dbUser.role === "INSTITUTE_ADMIN") {
      if (!req.dbUser.instituteId) {
        return res.status(403).json({ error: "Institute Admin has no institute assigned" });
      }
      where = { instituteId: req.dbUser.instituteId };
    }

    const [data, total] = await Promise.all([
      prisma.student.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.student.count({ where }),
    ]);

    res.status(200).json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }),
);

router.get(
  "/:id",
  canAccessStudents,
  requireOwnInstitute(studentInstituteFromExisting),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.status(200).json(student);
  }),
);

router.post(
  "/",
  canAccessStudents,
  requireOwnInstitute(studentInstituteFromBody),
  asyncHandler(async (req, res) => {
    const parsed = studentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const student = await prisma.student.create({ data: parsed.data });
    res.status(201).json(student);
  }),
);

router.patch(
  "/:id",
  canAccessStudents,
  requireOwnInstitute(studentInstituteFromExisting),
  asyncHandler(async (req, res) => {
    const parsed = studentUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    try {
      const student = await prisma.student.update({ where: { id: req.params.id }, data: parsed.data });
      res.status(200).json(student);
    } catch (err) {
      if (isPrismaNotFoundError(err)) {
        return res.status(404).json({ error: "Student not found" });
      }
      throw err;
    }
  }),
);

router.delete(
  "/:id",
  canAccessStudents,
  requireOwnInstitute(studentInstituteFromExisting),
  asyncHandler(async (req, res) => {
    try {
      await prisma.student.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      if (isPrismaNotFoundError(err)) {
        return res.status(404).json({ error: "Student not found" });
      }
      throw err;
    }
  }),
);

export default router;
```

Note the order on `POST`: `requireOwnInstitute(studentInstituteFromBody)`
reads `instituteId` straight off the raw request body, **before** Zod
validation runs. That's deliberate — we want to reject "wrong institute"
with a 403 before spending effort validating the rest of the payload.
If the body is malformed in other ways too, Zod still catches that right
after.

**Verify:** `pnpm --filter api typecheck` clean.

---

## Step 2.8 — Wire routes + global error handler, upgrade the frontend tester, full E2E verify

In `apps/api/src/index.ts`, add imports and mount the new routers, plus
the global error-handling middleware **as the very last `app.use` call**:
```ts
import institutesRouter from "./routes/institutes.js";
import studentsRouter from "./routes/students.js";
import type { ErrorRequestHandler } from "express";
```
```ts
app.use("/institutes", institutesRouter);
app.use("/students", studentsRouter);
```
At the bottom, after everything else (must be last):
```ts
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);
```

**Upgrade the frontend tester.** Phase 1's fixed test buttons don't scale
to real CRUD — replace `apps/frontend/src/app/page.tsx`'s `<SignedIn>`
block with a general-purpose API tester:
```tsx
"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  const { getToken } = useAuth();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/institutes?page=1&limit=10");
  const [body, setBody] = useState("");
  const [result, setResult] = useState("");

  async function callApi() {
    const token = await getToken();
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : body,
    });
    const text = await res.text();
    setResult(`${res.status}\n${text}`);
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Skill Credentialing System</h1>

      <SignedOut>
        <SignInButton mode="modal" />
        <SignUpButton mode="modal" />
      </SignedOut>

      <SignedIn>
        <UserButton />
        <h2>API tester</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <input style={{ flex: 1 }} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/institutes" />
        </div>
        <textarea
          style={{ width: "100%", height: "80px" }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder='{"name": "Test Institute", "code": "INST-TEST-001"}'
        />
        <div><button onClick={callApi}>Send</button></div>
        <pre>{result}</pre>
      </SignedIn>
    </main>
  );
}
```

### Full end-to-end verify

```bash
pnpm turbo run build lint typecheck --force
pnpm --filter api dev        # if not running
pnpm --filter frontend dev   # if not running
```
Visit `localhost:3000`, signed in as your Phase 1 test account.

1. **GET** `/institutes?page=1&limit=10` → `200`, two seeded institutes.
   Copy `institute1`'s `id` from the response (or reuse the one you
   saved after seeding).
2. Your role is currently whatever you left it as in Phase 1 — set it
   to `STUDENT` via `pnpm --filter @credential/database studio` if it
   isn't already. **GET** `/students` → expect **403**.
3. In Prisma Studio, set your role to `INSTITUTE_ADMIN` and `instituteId`
   to `institute1`'s id. **GET** `/students` → expect **200**, showing
   only the 2 students seeded under `institute1` (not the 3rd, under
   `institute2`).
4. **POST** `/students` with method `POST`, body:
   ```json
   {"fullName": "Wrong Institute Test", "email": "wrong@example.com", "instituteId": "<institute2's id>"}
   ```
   Expect **403** — `Forbidden — not your institute`.
5. Same POST, but with `institute1`'s id → expect **201**, new student created.
6. In Prisma Studio, set your role to `SUPER_ADMIN` (leave `instituteId`
   as-is, it's ignored for this role). **GET** `/students` → expect
   **200**, now showing students from **both** institutes.
7. **PATCH** `/institutes/<institute1's id>`, body `{"state": "Updated"}`
   → expect **200**.
8. **DELETE** `/institutes/does-not-exist` → expect **404**, not a 500.
9. **GET** `/students?page=1&limit=1` → `data` array has exactly 1 item,
   `pagination.total` matches the real total count, `pagination.totalPages`
   is correct for that total/limit.

If 1–9 all behave as described, Phase 2 is done — role-tier gating,
ownership scoping, pagination, and not-found handling all confirmed
working together, not just individually.

---

## Phase 2 Sanity Check

```bash
pnpm turbo run build lint typecheck --force
```
Everything green.

```bash
docker compose exec postgres psql -U credential -d credential_dev -c "SELECT code, state FROM institutes;"
docker compose exec postgres psql -U credential -d credential_dev -c "SELECT \"fullName\", \"instituteId\" FROM students;"
```
Confirms seed data landed correctly and matches what the API returned above.

Set your own test user's role back to whatever you want to actually
develop as going forward before moving on — don't leave it on
`SUPER_ADMIN` by habit if you're about to test something role-specific
in Phase 3.

---

## Update `docs/PLAN.md`

Replace the entire Phase 2 section with this:

```markdown
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
```

Update **Current Status**:
```
- **Active phase:** 3 — Canonical Certificate + Hashing
- **Active step:** not started
- **Last completed step:** 2.8
```

Add a Progress Log row (today's date, phase `2`, steps `2.1–2.8`, a
short note, your commit hash).

Two additions worth making elsewhere in the file, both things that would
otherwise get lost by the time they matter:

Under **Monorepo Path Conventions**, add:
```
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
```

Under **Phase 7** in the plan, add a note (don't change the steps
themselves, just flag this so it's not forgotten):
```
NOTE: /verify/:certificateId must be PUBLIC — no auth required.
Confirmed with project owner: anyone scanning a certificate's QR code
needs to see Verified/Tampered/Revoked without logging in. This is a
deliberate, single exception to the "everything requires auth" pattern
established in Phases 1–2 — don't accidentally wrap it in
requireAuthenticated when building Phase 7.
```
