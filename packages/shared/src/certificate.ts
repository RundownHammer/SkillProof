import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";

/**
 * Canonical certificate JSON (doc §4).
 * Only this JSON is hashed; PDFs and translations are derived from it.
 *
 * Field order is locked and MUST NOT change — it is part of the hash
 * contract used by Phases 3–7 (blockchain anchor, verification, QR).
 */
export const canonicalCertificateSchema = z.object({
  certificateId: z.string().min(1),
  studentId: z.string().min(1),
  qualificationCode: z.string().min(1),
  credits: z.number().int().nonnegative(),
  grade: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "issueDate must be YYYY-MM-DD"),
  issuerId: z.string().min(1),
});

export type CanonicalCertificate = z.infer<typeof canonicalCertificateSchema>;

export const canonicalCertificateExample: CanonicalCertificate = {
  certificateId: "CERT-2026-000001",
  studentId: "ST12345",
  qualificationCode: "QF102",
  credits: 24,
  grade: "A",
  issueDate: "2026-06-30",
  issuerId: "NCVET001",
};

/**
 * Resolved inputs needed to assemble the canonical certificate.
 * `qualificationCode` / `issuerId` are official codes looked up from the
 * database relations (Qualification.code, Institute.code) before calling
 * the builder — the builder itself is pure and has no DB access.
 */
export interface CanonicalCertificateInput {
  certificateId: string;
  studentId: string;
  qualificationCode: string;
  credits: number;
  grade: string;
  issueDate: string; // YYYY-MM-DD
  issuerId: string;
}

/**
 * Pure: assemble the canonical object in the locked field order.
 * No hashing, no blockchain, no PDF, no side effects.
 */
export function buildCanonicalCertificate(input: CanonicalCertificateInput): CanonicalCertificate {
  return {
    certificateId: input.certificateId,
    studentId: input.studentId,
    qualificationCode: input.qualificationCode,
    credits: input.credits,
    grade: input.grade,
    issueDate: input.issueDate,
    issuerId: input.issuerId,
  };
}

/**
 * Pure: deterministic SHA-256 (hex) of the canonical JSON.
 * `JSON.stringify` preserves the insertion order of `buildCanonicalCertificate`,
 * so the hash is stable as long as that order is unchanged.
 * Never hash Prisma objects directly — hash the canonical JSON only.
 */
export function hashCanonicalCertificate(cert: CanonicalCertificate): string {
  const json = JSON.stringify(cert);
  return createHash("sha256").update(json).digest("hex");
}

/**
 * Format a Date as YYYY-MM-DD in UTC. Deterministic and timezone-stable,
 * so the same calendar date always serializes identically.
 */
export function formatIssueDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generate a unique, human-readable certificate id, e.g. `CERT-2026-1A2B3C4D`.
 * The hash does not depend on the id being sequential — only that it is
 * stable for a given certificate (it is stored on creation).
 */
export function generateCertificateId(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `CERT-${year}-${suffix}`;
}

/** Validation schema for POST /certificates request bodies. */
export const certificateCreateSchema = z.object({
  studentId: z.string().min(1),
  qualificationId: z.string().min(1),
  instituteId: z.string().min(1),
  credits: z.number().int().nonnegative(),
  grade: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "issueDate must be YYYY-MM-DD"),
});

export type CertificateCreateInput = z.infer<typeof certificateCreateSchema>;
