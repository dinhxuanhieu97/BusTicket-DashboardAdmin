import { z } from "zod";
import { staffUserSchema } from "./live-contracts";

/** Hợp đồng API quản trị nền tảng (khớp `apps/api/src/admin/admin.controller.ts`). */
export const platformOperatorSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});
export const platformOperatorsSchema = z.object({
  operators: z.array(platformOperatorSchema).max(1000),
});
export const ownerAccountSchema = staffUserSchema.extend({
  mustChangePassword: z.boolean(),
  lockedUntil: z.string().nullable(),
});
export const ownerListSchema = z.object({
  owners: z.array(ownerAccountSchema).max(200),
});
export const temporaryPasswordInput = z
  .object({
    password: z.string().min(10).max(128),
    adminPassword: z.string().min(1).max(128),
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .strict();
export type PlatformOperator = z.infer<typeof platformOperatorSchema>;
export type OwnerAccount = z.infer<typeof ownerAccountSchema>;

/** Mật khẩu tạm ngẫu nhiên 16 ký tự, bỏ ký tự dễ nhầm (0/O, 1/l/I). */
export function randomTemporaryPassword(
  random: (n: number) => Uint8Array = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(random(16), (b) => alphabet[b % alphabet.length]).join("");
}
