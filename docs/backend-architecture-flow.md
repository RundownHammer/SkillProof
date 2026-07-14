# Backend Architecture & Flow

## Blockchain-Based Skill Credentialing System (SIH Problem 25200)

> This document defines the backend architecture, service boundaries,
> data flow, and implementation plan. It is intentionally
> implementation-oriented so an AI coding agent or developer can build
> the system incrementally.

------------------------------------------------------------------------

# 1. High-Level Architecture

                     ┌──────────────────────────┐
                     │        Frontend          │
                     │ Next.js / React + Clerk  │
                     └────────────┬─────────────┘
                                  │ HTTPS
                                  ▼
                        Express REST API
                                  │
          ┌──────────────┬─────────┼───────────┬──────────────┐
          ▼              ▼         ▼           ▼              ▼
     Auth/RBAC   Certificate   Verification  Blockchain    Admin
      Module        Module        Module       Module      Module
          │              │         │           │
          └──────────────┼─────────┴───────────┘
                         ▼
                 PostgreSQL (Prisma)
                         │
            ┌────────────┴─────────────┐
            ▼                          ▼
     Supabase Storage            BullMQ Queue
            │                          │
            ▼                          ▼
     Certificate PDFs         Async Workers
                                       │
                                       ▼
                               Polygon Smart Contract

------------------------------------------------------------------------

# 2. Tech Stack

  Layer            Technology           Responsibility
  ---------------- -------------------- -----------------------
  Runtime          Node.js 22           Server runtime
  Language         TypeScript           Type safety
  Framework        Express              REST API
  ORM              Prisma               Database access
  Database         PostgreSQL           Business data
  Object Storage   Supabase Storage     Certificate PDFs
  Authentication   Clerk                Identity
  Authorization    Custom RBAC          Permissions
  Queue            BullMQ               Background processing
  Cache            Redis                Queue + caching
  Blockchain       Polygon              Immutable proof
  Smart Contract   Solidity + Hardhat   Hash registry
  PDF              Puppeteer            HTML → PDF
  Validation       Zod                  Request validation
  API Docs         Swagger              API documentation

------------------------------------------------------------------------

# 3. Core Design Principle

Blockchain is NOT the database.

Store only immutable proof on-chain.

Store everything else off-chain.

## PostgreSQL stores

-   Users
-   Students
-   Institutes
-   Qualifications
-   Certificate metadata
-   Verification logs
-   Audit logs
-   Blockchain transaction hash
-   PDF URL

## Supabase Storage stores

-   Generated PDFs
-   Certificate templates
-   Logos
-   Assets

## Polygon stores

-   Certificate ID
-   SHA-256 hash of canonical certificate JSON
-   Issue timestamp
-   Issuer address
-   Revocation status

------------------------------------------------------------------------

# 4. Canonical Certificate Model

Every certificate is represented internally as canonical JSON.

``` json
{
  "certificateId": "CERT-2026-000001",
  "studentId": "ST12345",
  "qualificationCode": "QF102",
  "credits": 24,
  "grade": "A",
  "issueDate": "2026-06-30",
  "issuerId": "NCVET001"
}
```

Only this JSON is hashed.

PDFs are generated FROM this data.

This allows multiple languages and templates while preserving one
immutable credential.

    **Field mapping (locked — changing it re-anchors the whole chain):**
    - `certificateId` → `Certificate.certificateId` (generated at issuance, e.g. `CERT-2026-1A2B3C4D`)
    - `studentId` → `Student.id` (DB primary key; no separate student code invented)
    - `qualificationCode` → `Qualification.code` (official NCVET/NSQF code)
    - `credits` → `Certificate.credits`
    - `grade` → `Certificate.grade`
    - `issueDate` → `Certificate.issueDate` formatted `YYYY-MM-DD` (UTC)
    - `issuerId` → `Institute.code` (resolved from `Certificate.instituteId`)

    The canonical builder (`buildCanonicalCertificate`) and SHA-256 hasher
    (`hashCanonicalCertificate`) are **pure functions** in `packages/shared`
    with no DB, blockchain, or PDF side effects. The API resolves relation ids
    to official codes before calling them. Only this JSON is hashed — never
    Prisma objects, PDFs, names, titles, logos, signatures, QR codes, or
    language.

------------------------------------------------------------------------

# 5. Certificate Issuance Flow

    Institute/Admin

          │

    Upload CSV / API

          │

    Validate (Zod)

          │

    Store rows

          │

    Create BullMQ Job

          │

    ──────── Worker ────────

    Generate canonical JSON

    ↓

    SHA-256(JSON)

    ↓

    Store metadata in PostgreSQL

    ↓

    Write hash to Polygon

    ↓

    Generate PDF (Puppeteer)

    ↓

    Upload PDF to Supabase

    ↓

    Update DB

    ↓

    Notify student

All heavy operations happen asynchronously.

API returns immediately after job creation.

**Implementation note (Phase 3):** canonical JSON and its SHA-256 hash are
computed at *issuance time* by `POST /certificates` (API) and stored on the
`Certificate` row (`canonicalJson`, `hash`, `status = QUEUED`). The worker
(Phases 4–5) later anchors that already-computed hash on Polygon — it does not
recompute it. This keeps a single source of truth for the hash used by
verification (Phase 7).

------------------------------------------------------------------------

# 6. Bulk Issuance

Bulk issuance is the default workflow.

Input:

-   CSV
-   Excel
-   Government API

Processing:

1.  Validate file
2.  Parse rows
3.  Create one BullMQ job per certificate
4.  Workers process in parallel
5.  Retry failed jobs automatically
6.  Dashboard shows progress

Future optimization:

-   Batch hashes using a Merkle Tree.
-   Store only the Merkle Root on-chain for massive issuance.

Prototype can initially use one blockchain transaction per certificate.

------------------------------------------------------------------------

# 7. Blockchain Flow

Worker computes:

SHA256(canonical JSON)

↓

Calls Solidity contract

    issueCertificate(
        certificateId,
        hash
    )

Blockchain returns

    transactionHash

Store transaction hash inside PostgreSQL.

No PDF is ever stored on-chain.

------------------------------------------------------------------------

# 8. Verification Flow

Preferred verification uses QR code.

    Employer

    ↓

    Scan QR

    ↓

    certificateId

    ↓

    Backend

    ↓

    Fetch certificate metadata

    ↓

    Recreate canonical JSON

    ↓

    SHA256(JSON)

    ↓

    Read blockchain hash

    ↓

    Compare

    ↓

    Verified / Tampered / Revoked

The verification page displays the official certificate retrieved from
storage rather than trusting an uploaded document.

Optional feature:

Employer may upload a PDF.

System extracts certificateId from embedded QR or metadata and verifies
against blockchain.

------------------------------------------------------------------------

# 9. Multilingual Architecture

Database stores language-independent data.

Example:

    qualificationCode = QF102

Language table:

    QF102

    English -> Assistant Electrician

    Hindi -> सहायक इलेक्ट्रीशियन

    Tamil -> ...

    Bengali -> ...

PDF templates exist for each language.

    Canonical JSON

    ↓

    Language Template

    ↓

    PDF

Blockchain hash never changes because language is presentation, not
data.

------------------------------------------------------------------------

# 10. Queue Responsibilities

BullMQ handles:

-   Bulk issuance
-   PDF generation
-   Blockchain submission
-   Email notifications
-   Retry logic

Jobs should be idempotent.

Each stage updates progress in PostgreSQL.

Example statuses:

-   queued
-   validating
-   hashing
-   blockchain_pending
-   generating_pdf
-   uploading
-   completed
-   failed

------------------------------------------------------------------------

# 11. Object Storage

Supabase stores:

    /certificates/{certificateId}.pdf
    /templates/en.html
    /templates/hi.html
    /logos/

Database stores only public/private storage path.

------------------------------------------------------------------------

# 12. Authentication

Handled entirely by Clerk.

Backend trusts Clerk JWT.

Middleware:

    Verify JWT

    ↓

    Load user

    ↓

    Load role

    ↓

    Apply RBAC

------------------------------------------------------------------------

# 13. Authorization

Roles:

-   Super Admin
-   NCVET Admin
-   Institute Admin
-   Student
-   Employer
-   Verifier

Permissions are enforced by RBAC middleware.

Example:

    Issue Certificate

    ↓

    Institute Admin only

------------------------------------------------------------------------

# 14. Database Modules

Main entities:

-   User
-   Institute
-   Student
-   Qualification
-   Certificate
-   Verification
-   BlockchainTransaction
-   AuditLog

Relationships should remain normalized.

------------------------------------------------------------------------

# 15. Smart Contract

Responsibilities only:

-   Issue certificate hash
-   Retrieve hash
-   Check existence
-   Revoke certificate

Never store PDFs or personal data.

------------------------------------------------------------------------

# 16. API Modules

    /auth

    /users

    /institutes

    /students

    /qualifications

    /certificates

    /verification

    /blockchain

    /admin

    /health

Each module owns its controller, service, validation schema and routes.

------------------------------------------------------------------------

# 17. Security

-   SHA-256 hashing
-   HTTPS
-   Clerk authentication
-   RBAC authorization
-   Zod validation
-   Audit logs
-   Immutable blockchain proof
-   Rate limiting
-   Input sanitization

------------------------------------------------------------------------

# 18. Recommended Folder Structure

    src/
      modules/
        auth/
        users/
        institutes/
        students/
        qualifications/
        certificates/
        verification/
        blockchain/
        admin/

      services/
        pdf/
        storage/
        queue/
        hashing/
        blockchain/

      workers/

      middleware/

      prisma/

      contracts/

      utils/

      config/

------------------------------------------------------------------------

# 19. Development Order

1.  Authentication
2.  RBAC
3.  Prisma schema
4.  Certificate CRUD
5.  BullMQ
6.  PDF generation
7.  Supabase upload
8.  Solidity contract
9.  Blockchain integration
10. QR verification
11. Bulk issuance
12. Multilingual templates
13. Swagger
14. Deployment

------------------------------------------------------------------------

# 20. Guiding Principles

-   Blockchain is the source of truth for certificate integrity.
-   PostgreSQL is the source of truth for application data.
-   Supabase is the source of truth for document storage.
-   Canonical JSON is the source of truth for credential content.
-   PDFs are generated views, not authoritative records.
-   Every expensive operation runs asynchronously through BullMQ.
-   Design APIs to support future integration with DigiLocker, Skill
    India Digital and Academic Bank of Credits via adapter interfaces.
