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
/** Mã nhà xe: 2–4 chữ in hoa — là tiền tố mã vé, mã xe và nội dung chuyển khoản, không đổi được sau khi tạo. */
export const OPERATOR_CODE = /^[A-Z]{2,4}$/;
export const createOperatorInput = z
  .object({
    code: z.string().regex(OPERATOR_CODE),
    name: z.string().trim().min(1).max(120),
  })
  .strict();
export const createOwnerInput = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).max(30),
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
