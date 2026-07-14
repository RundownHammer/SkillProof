import { Router } from "express";
import { prisma } from "@credential/database";
import { instituteCreateSchema, instituteUpdateSchema, paginationQuerySchema } from "@credential/shared";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import { requireOwnInstitute, instituteIdFromParam } from "../middleware/ownership.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isPrismaNotFoundError } from "../utils/prisma-errors.js";
import { getParam } from "../utils/get-param.js";

const router: ReturnType<typeof Router> = Router();

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
    const institute = await prisma.institute.findUnique({ where: { id: getParam(req, "id") } });
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
      const institute = await prisma.institute.update({ where: { id: getParam(req, "id") }, data: parsed.data });
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
      await prisma.institute.delete({ where: { id: getParam(req, "id") } });
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
