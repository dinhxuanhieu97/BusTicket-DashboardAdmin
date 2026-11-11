import { z } from "zod";
import { staffRoleSchema, staffStatusSchema } from "@/lib/live-contracts";

export const createStaffInput = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(30),
  password: z.string().min(10).max(128),
  role: staffRoleSchema,
});

export const updateStaffInput = createStaffInput
  .extend({ status: staffStatusSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
