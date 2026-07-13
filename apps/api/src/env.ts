import { envSchema } from "@credential/shared";
import { z } from "zod";

const apiEnvSchema = envSchema.extend({
  CLERK_SECRET_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

export const env = apiEnvSchema.parse(process.env);