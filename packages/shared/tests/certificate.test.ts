import { describe, it, expect } from "vitest";
import {
  buildCanonicalCertificate,
  hashCanonicalCertificate,
  formatIssueDate,
  generateCertificateId,
  canonicalCertificateSchema,
  type CanonicalCertificate,
} from "../src/certificate.js";

const sampleInput = {
  certificateId: "CERT-2026-000001",
  studentId: "cmrkstudent1",
  qualificationCode: "QF102",
  credits: 24,
  grade: "A",
  issueDate: "2026-06-30",
  issuerId: "INST-DEL-001",
};

describe("buildCanonicalCertificate", () => {
  it("produces identical JSON for identical input", () => {
    const a = buildCanonicalCertificate(sampleInput);
    const b = buildCanonicalCertificate(sampleInput);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps the locked canonical field order", () => {
    const json = JSON.stringify(buildCanonicalCertificate(sampleInput));
    expect(json.startsWith('{"certificateId"')).toBe(true);
    expect(json.endsWith('"issuerId":"INST-DEL-001"}')).toBe(true);
  });

  it("conforms to the canonical schema", () => {
    expect(() => canonicalCertificateSchema.parse(buildCanonicalCertificate(sampleInput))).not.toThrow();
  });
});

describe("hashCanonicalCertificate (SHA-256)", () => {
  it("same canonical JSON -> identical 64-char hex hash", () => {
    const h1 = hashCanonicalCertificate(buildCanonicalCertificate(sampleInput));
    const h2 = hashCanonicalCertificate(buildCanonicalCertificate(sampleInput));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changing any single hashed field changes the hash", () => {
    const base: CanonicalCertificate = buildCanonicalCertificate(sampleInput);
    const baseHash = hashCanonicalCertificate(base);
    const fields = [
      "certificateId",
      "studentId",
      "qualificationCode",
      "credits",
      "grade",
      "issueDate",
      "issuerId",
    ] as const;

    for (const field of fields) {
      const mutated = { ...base } as Record<string, unknown>;
      mutated[field] = field === "credits" ? (base.credits as number) + 1 : `${base[field]}X`;
      const h = hashCanonicalCertificate(mutated as unknown as CanonicalCertificate);
      expect(h).not.toBe(baseHash);
    }
  });
});

describe("formatIssueDate", () => {
  it("formats as deterministic YYYY-MM-DD in UTC", () => {
    expect(formatIssueDate(new Date("2026-06-30T00:00:00.000Z"))).toBe("2026-06-30");
    expect(formatIssueDate(new Date("2026-12-01T23:59:59.000Z"))).toBe("2026-12-01");
    expect(formatIssueDate(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });
});

describe("generateCertificateId", () => {
  it("is unique across calls and human-readable", () => {
    const a = generateCertificateId();
    const b = generateCertificateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^CERT-\d{4}-[0-9A-F]{8}$/);
  });
});
