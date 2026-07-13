import type { User } from "@credential/database";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
    }
  }
}

export {};
