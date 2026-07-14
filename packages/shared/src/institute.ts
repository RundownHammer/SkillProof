import { z } from "zod";

export const instituteCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  state: z.string().optional(),
});

export const instituteUpdateSchema = instituteCreateSchema.partial();

export type InstituteCreateInput = z.infer<typeof instituteCreateSchema>;
export type InstituteUpdateInput = z.infer<typeof instituteUpdateSchema>;
