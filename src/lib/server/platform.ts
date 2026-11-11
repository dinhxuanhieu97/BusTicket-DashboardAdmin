import "server-only";
import { z } from "zod";
import { ApiError, requirePermission } from "../access-policy";
import { platformSession } from "./session";

const idSchema = z.uuid();

/** Phiên quản trị nền tảng có quyền đặt mật khẩu tạm cho chủ xe. */
export async function platformOwnerAccess(permission: string) {
  const { token, session } = await platformSession();
  requirePermission(session, permission);
  return { token };
}

export function uuidParam(value: string, label: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(400, "VALIDATION_FAILED", `Mã ${label} không hợp lệ.`);
  return parsed.data;
}

export function rejectQuery(request: Request) {
  if (new URL(request.url).searchParams.size)
    throw new ApiError(400, "VALIDATION_FAILED", "Tham số không được hỗ trợ.");
}
