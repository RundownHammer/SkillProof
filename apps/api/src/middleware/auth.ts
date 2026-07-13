import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { prisma, type Role } from "@credential/database";

export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function syncUser(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    return next(); // requireAuthenticated (runs first) already handles the 401
  }

  let user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });

  if (!user) {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;

    if (!email) {
      return res.status(400).json({ error: "Clerk user has no primary email" });
    }

    // New users default to STUDENT — the least-privileged role. Promoting
    // someone to Institute Admin / NCVET Admin / Super Admin is an
    // explicit admin action, arriving in Phase 11 (Admin module). For now,
    // promote yourself manually via Prisma Studio while testing (Step 1.7).
    user = await prisma.user.create({
      data: { clerkId: auth.userId, email, role: "STUDENT" },
    });
  }

  req.dbUser = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
