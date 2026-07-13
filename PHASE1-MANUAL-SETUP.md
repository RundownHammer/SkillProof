# Phase 1 — Auth & RBAC Manual Setup Guide (Copy-Paste Edition)

Covers `docs/PLAN.md` Phase 1, revised to include frontend Clerk wiring
(see the note at the top of the chat response for why). Do steps in
order; every step ends with a `Verify`.

## Prerequisites

- Phase 0 complete and passing its full sanity check
- Docker containers running: `docker compose up -d`
- A free [Clerk](https://dashboard.clerk.com) account

---

## Step 1.1 — Create a Clerk application, get your keys

1. Go to https://dashboard.clerk.com and sign in (or sign up).
2. Click **Create application**. Name it e.g. `Skill Credentialing System`.
3. Under sign-in options, **Email** is enough for now — leave the rest at defaults.
4. Once created, go to **API keys** in the left sidebar. You'll see:
   - **Publishable key** — starts with `pk_test_...`
   - **Secret key** — starts with `sk_test_...`

Create `apps/frontend/.env.local` (Next.js convention — this file is
already gitignored by `create-next-app`'s default `.gitignore`):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Add the same secret key to `apps/api/.env` (append, don't replace what's
already there from Phase 0):
```
CLERK_SECRET_KEY=sk_test_your_key_here
FRONTEND_URL=http://localhost:3000
```

Only the secret key goes to the backend — the publishable key is
client-safe and frontend-only by design; the backend never needs it.

**Verify:** both files have real (not placeholder) key values, and
`apps/frontend/.env.local` is not tracked by `git status`.

---

## Step 1.2 — Frontend: wire up Clerk

`@clerk/nextjs` is already a dependency from Phase 0's scaffold — no
install needed, just wiring.

Create `apps/frontend/src/middleware.ts`:
```ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```
(Next.js ≤15 uses `middleware.ts` — you're on 15.5.x per your last build
log, so this is the correct filename. Later Next versions rename this to
`proxy.ts`; not relevant yet.)

Replace `apps/frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skill Credentialing System",
  description: "SIH Problem Statement 25200",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

Replace `apps/frontend/src/app/page.tsx` — this becomes your manual
test harness for the rest of Phase 1, not just a placeholder:
```tsx
"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TEST_ROUTES = [
  "any-authenticated",
  "super-admin",
  "ncvet-admin",
  "institute-admin",
  "student",
  "employer",
  "verifier",
];

export default function Home() {
  const { getToken } = useAuth();
  const [result, setResult] = useState("");

  async function callRoute(path: string) {
    const token = await getToken();
    const res = await fetch(`${API_URL}/test/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    setResult(`${res.status} — ${JSON.stringify(body)}`);
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
        <h2>Test protected routes</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {TEST_ROUTES.map((path) => (
            <button key={path} onClick={() => callRoute(path)}>
              {path}
            </button>
          ))}
        </div>
        <pre>{result}</pre>
      </SignedIn>
    </main>
  );
}
```

**Verify:**
```bash
pnpm --filter frontend dev
```
Visit `localhost:3000` — you should see Sign In / Sign Up buttons.
Clicking Sign Up should open Clerk's modal and let you create an
account. Don't test the buttons below the sign-in state yet — the API
side isn't wired up until Step 1.3+.

---

## Step 1.3 — Backend: install Clerk + CORS, verify unauthenticated → 401

```bash
pnpm add --filter api @clerk/express@latest cors@latest
pnpm add -D --filter api @types/cors@latest
```

Create `apps/api/src/env.ts` — this extends the shared env schema with
fields only the API needs, so `packages/shared` stays generic:
```ts
import { envSchema } from "@credential/shared";
import { z } from "zod";

const apiEnvSchema = envSchema.extend({
  CLERK_SECRET_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

export const env = apiEnvSchema.parse(process.env);
```

Replace `apps/api/src/index.ts`:
```ts
import express from "express";
import cors from "cors";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { prisma } from "@credential/database";
import { env } from "./env.js";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "api",
    prismaClientLoaded: typeof prisma === "object",
  });
});

// Temporary — proves clerkMiddleware() + getAuth() actually work.
// Replaced by the real test router in Step 1.7.
app.get("/test/ping", (req, res) => {
  const auth = getAuth(req);
  if (!auth.isAuthenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.status(200).json({ message: "pong", userId: auth.userId });
});

app.listen(env.PORT, () => {
  console.log(`api listening on port ${env.PORT}`);
});
```

**Verify:**
```bash
pnpm --filter api dev
```
In another terminal:
```bash
curl -i localhost:4000/test/ping
```
Expect **401**, no token supplied. Leave the api running for the next steps.

---

## Step 1.4 — `User` model + `Role` enum, migrate

Edit `packages/database/prisma/schema.prisma` — append below the
existing datasource/generator block:
```prisma
enum Role {
  SUPER_ADMIN
  NCVET_ADMIN
  INSTITUTE_ADMIN
  STUDENT
  EMPLOYER
  VERIFIER
}

model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  role      Role     @default(STUDENT)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

Migrate (needs Docker Postgres running):
```bash
pnpm --filter @credential/database migrate -- --name add_user_and_role
pnpm --filter @credential/database generate
```

Update `packages/database/src/index.ts` to re-export the generated
model types and enum, so other packages can import `Role` and `User`:
```ts
export * from "./client.js";
export * from "./generated/prisma/client.js";
```

**Verify:**
```bash
pnpm --filter @credential/database validate
docker compose exec postgres psql -U credential -d credential_dev -c "\d users"
```
Second command should print the `users` table's columns.

---

## Step 1.5 — Sync-on-login middleware

Create `apps/api/src/types/express.d.ts` — augments Express's `Request`
type with our local DB user, same pattern Clerk itself uses for `.auth`:
```ts
import type { User } from "@credential/database";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
    }
  }
}

export {};
```

Create `apps/api/src/middleware/auth.ts`:
```ts
import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { prisma, type Role } from "@credential/database";

export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function syncUser(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    return next(); // requireAuthenticated (runs first) already handles the 401
  }

  let user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });

  if (!user) {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;

    if (!email) {
      return res.status(400).json({ error: "Clerk user has no primary email" });
    }

    // New users default to STUDENT — the least-privileged role. Promoting
    // someone to Institute Admin / NCVET Admin / Super Admin is an
    // explicit admin action, arriving in Phase 11 (Admin module). For now,
    // promote yourself manually via Prisma Studio while testing (Step 1.7).
    user = await prisma.user.create({
      data: { clerkId: auth.userId, email, role: "STUDENT" },
    });
  }

  req.dbUser = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
```

**Verify:**
```bash
pnpm --filter api typecheck
```
Clean — this confirms the `Role`/`User` types imported correctly from
`@credential/database` and the global `Request.dbUser` augmentation works.

---

## Step 1.6 — Wire the middleware chain, remove the throwaway ping route

In `apps/api/src/index.ts`, replace the `/test/ping` block and imports:
```ts
import { requireAuthenticated, syncUser } from "./middleware/auth.js";
```
```ts
app.get("/test/any-authenticated", requireAuthenticated, syncUser, (req, res) => {
  res.status(200).json({ message: "you are authenticated", role: req.dbUser?.role });
});
```
(Remove the old `getAuth` import and the `/test/ping` route entirely —
this new route does the same job properly, using the real middleware chain.)

**Verify:**
```bash
curl -i localhost:4000/test/any-authenticated
```
Still 401 with no token — the chain works the same as the inline version did.

---

## Step 1.7 — Role-gated test routes, full end-to-end verify

Create `apps/api/src/routes/test.ts`:
```ts
import { Router } from "express";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import type { Role } from "@credential/database";

const router = Router();

router.get("/any-authenticated", requireAuthenticated, syncUser, (req, res) => {
  res.status(200).json({ message: "you are authenticated", role: req.dbUser?.role });
});

const roleRoutes: Record<string, Role> = {
  "super-admin": "SUPER_ADMIN",
  "ncvet-admin": "NCVET_ADMIN",
  "institute-admin": "INSTITUTE_ADMIN",
  student: "STUDENT",
  employer: "EMPLOYER",
  verifier: "VERIFIER",
};

for (const [path, role] of Object.entries(roleRoutes)) {
  router.get(
    `/${path}`,
    requireAuthenticated,
    syncUser,
    requireRole(role),
    (req, res) => {
      res.status(200).json({ message: `welcome, ${role}`, role: req.dbUser?.role });
    },
  );
}

export default router;
```

In `apps/api/src/index.ts`: remove the inline `/test/any-authenticated`
route from Step 1.6, and mount the router instead:
```ts
import testRouter from "./routes/test.js";
```
```ts
app.use("/test", testRouter);
```

**Verify — full end-to-end, using the frontend:**

```bash
pnpm --filter api dev        # if not already running
pnpm --filter frontend dev   # new terminal
```

1. Visit `localhost:3000`, click **Sign Up**, create a real account
   through Clerk's modal.
2. Once signed in, click the `any-authenticated` button — expect
   `200 — {"message":"you are authenticated","role":"STUDENT"}`.
3. Confirm the row landed in Postgres:
   ```bash
   docker compose exec postgres psql -U credential -d credential_dev -c "SELECT * FROM users;"
   ```
   One row, `role = STUDENT`.
4. Click any of the other 6 role buttons (e.g. `super-admin`) — expect
   **403 Forbidden**, since your account is still `STUDENT`.
5. Promote yourself to test a different tier:
   ```bash
   pnpm --filter @credential/database studio
   ```
   Opens Prisma Studio in your browser. Open the `users` table, change
   your row's `role` to e.g. `SUPER_ADMIN`, save.
6. Back on `localhost:3000`, click `super-admin` again (no need to
   re-login or refresh the page) — expect
   `200 — {"message":"welcome, SUPER_ADMIN",...}`. Role is looked up
   fresh from Postgres on every request, so the change takes effect
   immediately.
7. Repeat step 5–6 for a couple of the other roles if you want extra
   confidence, then set your role back to whatever you'll actually use
   going forward.

If all of 1–6 behave as described, Phase 1 is genuinely done — 401 with
no token, 403 with the wrong role, 200 with the right one, and a real
Postgres row created on first login.

---

## Phase 1 Sanity Check

Beyond the individual step verifies, worth confirming together:

**1. Full workspace still builds clean** (a new package + new deps can
regress things elsewhere):
```bash
pnpm turbo run build lint typecheck --force
```

**2. CORS is actually doing something** — temporarily change
`FRONTEND_URL` in `apps/api/.env` to something wrong (e.g.
`http://localhost:9999`), restart the api, and confirm the frontend's
fetch calls now fail with a CORS error in the browser console. Then set
it back to `http://localhost:3000` and confirm it works again. This
proves CORS is actually enforcing something, not just present and inert.

**3. No stray `.env` secrets committed:**
```bash
git status
git diff --cached -- apps/frontend/.env.local apps/api/.env
```
Neither file should ever show up as tracked.

---

## Update `docs/PLAN.md`

Replace the entire Phase 1 section with this (steps changed from 5 to 7
to reflect the frontend wiring added above):

```markdown
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
```

Update the **Current Status** block:
```
- **Active phase:** 2 — Core Database Schema
- **Active step:** not started
- **Last completed step:** 1.7
```

Add a Progress Log row with today's date, phase `1`, steps `1.1–1.7`, a
short note, and your commit hash.

Also worth a one-line addition to the **Monorepo Path Conventions**
section, since this phase introduced a new pattern worth keeping
consistent going forward:
```
apps/*/src/env.ts     each app extends packages/shared's base envSchema
                       with its own required fields via .extend() —
                       don't add app-specific env vars to the shared
                       schema itself
```
