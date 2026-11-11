import "server-only";
import { cache } from "react";
import { z } from "zod";
import { backendRequest } from "../backend-client";
import { OPERATOR_CODE, logoUrl, type Brand } from "../brand";

const brandSchema = z.object({
  code: z.string().regex(OPERATOR_CODE),
  name: z.string().min(1).max(120),
  logoVersion: z
    .string()
    .regex(/^\d{1,20}$/)
    .nullable(),
});

/**
 * Nhà xe của bản dashboard này (`PNTICKET_BRAND_OPERATOR_CODE`). Chưa cấu hình, mã sai, hoặc API lỗi → null
 * để trang đăng nhập ẩn khối thương hiệu thay vì hiện tên mặc định.
 */
export const loadBrand = cache(async (): Promise<Brand | null> => {
  const code = process.env.PNTICKET_BRAND_OPERATOR_CODE?.trim();
  if (!code || !OPERATOR_CODE.test(code)) return null;
  try {
    const b = brandSchema.parse(
      await backendRequest(`/api/v1/operators/${code}/brand`),
    );
    return {
      code: b.code,
      name: b.name,
      logoUrl: logoUrl(b.code, b.logoVersion),
    };
  } catch {
    return null;
  }
});
