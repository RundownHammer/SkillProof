import { z } from "zod";

/**
 * Environment variables shared across apps.
 * Each app may use a subset; validation helpers are frontend-safe (no Node imports).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // apps/api, apps/worker, packages/database
  DATABASE_URL: z.string().url().optional(),

  // apps/api, apps/worker
  REDIS_URL: z.string().url().optional(),

  // apps/api
  PORT: z.coerce.number().int().positive().default(3001),
  CLERK_SECRET_KEY: z.string().min(1).optional(),

  // apps/frontend
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // apps/worker (future phases)
  BLOCKCHAIN_MODE: z.enum(["mock", "real"]).default("mock"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  return envSchema.parse(input);
}
