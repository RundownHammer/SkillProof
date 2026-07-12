import { z } from "zod";

/**
 * Canonical certificate JSON (doc §4).
 * Only this JSON is hashed; PDFs and translations are derived from it.
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
