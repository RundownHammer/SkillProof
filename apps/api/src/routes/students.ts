import { Router } from "express";
import { prisma } from "@credential/database";
import { studentCreateSchema, studentUpdateSchema, paginationQuerySchema } from "@credential/shared";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import { requireOwnInstitute, studentInstituteFromBody, studentInstituteFromExisting } from "../middleware/ownership.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isPrismaNotFoundError } from "../utils/prisma-errors.js";
import { getParam } from "../utils/get-param.js";

const router: ReturnType<typeof Router> = Router();

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
    const student = await prisma.student.findUnique({ where: { id: getParam(req, "id") } });
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
      const student = await prisma.student.update({ where: { id: getParam(req, "id") }, data: parsed.data });
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
      await prisma.student.delete({ where: { id: getParam(req, "id") } });
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
