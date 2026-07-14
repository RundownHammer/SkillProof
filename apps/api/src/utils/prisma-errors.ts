import { Prisma } from "@credential/database";

export function isPrismaNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}
