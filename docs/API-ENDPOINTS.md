# API Reference

What the frontend (or a frontend-focused agent) needs to know to call
this API correctly. Updated at the end of every phase that adds or
changes an endpoint — check the **Last updated** line below before
assuming this is current.

**Last updated:** Phase 1 (Auth & RBAC)

---

## Base URL

Local development: `http://localhost:4000`

The frontend reads this from `NEXT_PUBLIC_API_URL` (see
`apps/frontend/.env.local`) — never hardcode the URL in frontend code.

---

## Authentication

Every protected endpoint expects a Clerk session token as a bearer token:
```
Authorization: Bearer <token>
```

**Getting a token (client component):**
```ts
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const token = await getToken();
```

**Getting a token (server component / route handler):**
```ts
import { auth } from "@clerk/nextjs/server";

const { getToken } = await auth();
const token = await getToken();
```

Call `getToken()` fresh immediately before each request rather than
caching the value yourself — Clerk session tokens are short-lived and
`getToken()` handles refreshing them automatically.

**Unauthenticated requests** (no header, or an invalid/expired token)
receive `401` from any protected endpoint. There is currently no way to
call a protected endpoint without a real signed-in Clerk session — there
is no API-key or service-token path yet.

---

## Roles

Every user has exactly one role, stored in Postgres (not in the Clerk
token itself — role changes take effect on a user's very next request,
no new token needed):

| Role | Notes |
|---|---|
| `SUPER_ADMIN` | |
| `NCVET_ADMIN` | |
| `INSTITUTE_ADMIN` | |
| `STUDENT` | Default for every newly-created user |
| `EMPLOYER` | |
| `VERIFIER` | |

New users are created with `STUDENT` automatically on their first
authenticated request — there's no signup-time role selection yet.
Promoting a user to a higher-privilege role is a manual/admin action;
self-serve role escalation does not exist and should never be exposed
in the frontend as if it does.

---

## Error Shape

Every error response (anywhere in the API, not just auth) uses:
```json
{ "error": "human-readable message" }
```

Standard status codes in use so far:

| Status | Meaning |
|---|---|
| `400` | Malformed request (e.g. an edge case in Clerk user data) |
| `401` | Missing, invalid, or expired token |
| `403` | Valid token, but the user's role isn't allowed on this route |
| `500` | Unexpected server error |

---

## CORS

The API only accepts cross-origin requests from `FRONTEND_URL`
(`apps/api/.env`, defaults to `http://localhost:3000`). Requests from
any other origin will fail with a CORS error in the browser console
before your code even sees a response — if you see that, check whether
the frontend is actually running on the port the API expects.

---

## Endpoints

### `GET /health`
Public, no auth required.

**Response `200`:**
```json
{ "status": "ok", "service": "api", "prismaClientLoaded": true }
```

---

### `GET /test/any-authenticated`
⚠️ **Throwaway — exists only to prove the auth chain works. Will be
removed once real endpoints exist; do not build real frontend features
against this route.**

Auth required, any role.

**Response `200`:**
```json
{ "message": "you are authenticated", "role": "STUDENT" }
```
**Response `401`:** no/invalid token.

---

### `GET /test/{role}`
⚠️ **Also throwaway, same caveat as above.**

Auth required, and the caller's role must match `{role}` exactly. One
route per tier:
```
GET /test/super-admin
GET /test/ncvet-admin
GET /test/institute-admin
GET /test/student
GET /test/employer
GET /test/verifier
```

**Response `200`:**
```json
{ "message": "welcome, SUPER_ADMIN", "role": "SUPER_ADMIN" }
```
**Response `401`:** no/invalid token.
**Response `403`:** valid token, wrong role.

---

## What's not here yet

No certificate, institute, student, or qualification endpoints exist
yet — those arrive starting Phase 2 (core schema + CRUD for institutes/
students), Phase 3 (certificate issuance), and Phase 7 (verification).
This file will grow with each phase; don't assume anything not listed
above exists, and don't build frontend UI against guessed future routes.
