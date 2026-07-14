import { Router } from "express";
import { prisma } from "@credential/database";
import {
  createCertificateIssuanceQueue,
  CERTIFICATE_ISSUANCE_QUEUE,
} from "@credential/queue";
import {
  certificateCreateSchema,
  buildCanonicalCertificate,
  hashCanonicalCertificate,
  generateCertificateId,
} from "@credential/shared";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import { requireOwnInstitute, studentInstituteFromBody } from "../middleware/ownership.js";
import { asyncHandler } from "../utils/async-handler.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const issuanceQueue = createCertificateIssuanceQueue({
  url: redisUrl,
  maxRetriesPerRequest: null,
});

const router: ReturnType<typeof Router> = Router();

router.use(requireAuthenticated, syncUser);

const canIssue = requireRole("SUPER_ADMIN", "NCVET_ADMIN", "INSTITUTE_ADMIN");

// Phase 3 only: create a QUEUED certificate row with canonical JSON + SHA-256 hash.
// No BullMQ job, no PDF, no blockchain call — those belong to later phases.
router.post(
  "/",
  canIssue,
  requireOwnInstitute(studentInstituteFromBody),
  asyncHandler(async (req, res) => {
    const parsed = certificateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { studentId, qualificationId, instituteId, credits, grade, issueDate } = parsed.data;

    // Resolve relations to the official codes required by the canonical JSON.
    const [student, qualification, institute] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId } }),
      prisma.qualification.findUnique({ where: { id: qualificationId } }),
      prisma.institute.findUnique({ where: { id: instituteId } }),
    ]);
    if (!student || !qualification || !institute) {
      return res.status(404).json({ error: "Student, qualification, or institute not found" });
    }

    const certificateId = generateCertificateId();
    const canonical = buildCanonicalCertificate({
      certificateId,
      studentId: student.id,
      qualificationCode: qualification.code,
      credits,
      grade,
      issueDate,
      issuerId: institute.code, // resolve Institute.id -> official code
    });
    const hash = hashCanonicalCertificate(canonical);

    const certificate = await prisma.certificate.create({
      data: {
        certificateId,
        studentId,
        qualificationId,
        instituteId,
        credits,
        grade,
        issueDate: new Date(`${issueDate}T00:00:00.000Z`),
        status: "QUEUED",
        canonicalJson: canonical,
        hash,
      },
    });

    // Phase 4: enqueue a job for the worker to process. The row is already
    // persisted as QUEUED; if enqueueing fails we keep the row QUEUED and
    // still return 201 (the worker can be retried out-of-band), rather than
    // failing the whole request. Enqueue failure is logged loudly below.
    try {
      await issuanceQueue.add(CERTIFICATE_ISSUANCE_QUEUE, {
        certificateId: certificate.id,
      });
    } catch (enqueueError) {
      console.error(
        `[certificates] FAILED to enqueue issuance job for certificate row ${certificate.id} (certificateId ${certificate.certificateId}). Row left in QUEUED status.`,
        enqueueError,
      );
    }

    res.status(201).json(certificate);
  }),
);

export default router;
