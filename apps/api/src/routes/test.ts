import { Router } from "express";
import { requireAuthenticated, syncUser, requireRole } from "../middleware/auth.js";
import type { Role } from "@credential/database";

const router: ReturnType<typeof Router> = Router();

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
