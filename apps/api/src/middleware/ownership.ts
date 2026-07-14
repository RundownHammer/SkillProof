import type { Request, Response, NextFunction } from "express";
import { prisma } from "@credential/database";
import { getParam } from "../utils/get-param.js";

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
  return getParam(req, "id");
}

export async function studentInstituteFromBody(req: Request): Promise<string | null> {
  return typeof req.body?.instituteId === "string" ? req.body.instituteId : null;
}

export async function studentInstituteFromExisting(req: Request): Promise<string | null> {
  const student = await prisma.student.findUnique({ where: { id: getParam(req, "id") } });
  return student?.instituteId ?? null;
}
