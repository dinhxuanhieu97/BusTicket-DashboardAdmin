import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import { ApiError } from "@/lib/access-policy";
import { staffUserSchema } from "@/lib/live-contracts";
import {
  createOwnerInput,
  ownerAccountSchema,
  ownerListSchema,
  randomTemporaryPassword,
} from "@/lib/platform";
import {
  platformOwnerAccess,
  rejectQuery,
  uuidParam,
} from "@/lib/server/platform";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";

type Context = { params: Promise<{ operatorId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    rejectQuery(request);
    const operatorId = uuidParam((await params).operatorId, "nhà xe");
    const { token } = await platformOwnerAccess("owner.password.reset");
    return json(
      ownerListSchema.parse(
        await backendRequest(`/api/v1/admin/operators/${operatorId}/owners`, {
          token,
        }),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

const reset = z.object({ owner: ownerAccountSchema });

/**
 * Tạo tài khoản chủ xe với mật khẩu tạm ngẫu nhiên, rồi đặt lại đúng mật khẩu đó qua luồng mật khẩu tạm để API bật
 * "bắt buộc đổi mật khẩu" (bước này cần mật khẩu/2FA của chính quản trị nền tảng). Mật khẩu tạm chỉ trả về một lần.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    protectMutation(request);
    rejectQuery(request);
    const operatorId = uuidParam((await params).operatorId, "nhà xe");
    const { token } = await platformOwnerAccess("user.manage");
    const { adminPassword, otp, ...profile } = await input(
      request,
      createOwnerInput,
    );
    const password = randomTemporaryPassword();
    const created = staffUserSchema.parse(
      await backendRequest(`/api/v1/admin/operators/${operatorId}/users`, {
        token,
        method: "POST",
        body: { ...profile, password, role: "OWNER" },
      }),
    );
    try {
      const { owner } = reset.parse(
        await backendRequest(
          `/api/v1/admin/operators/${operatorId}/owners/${created.id}/temporary-password`,
          {
            token,
            method: "POST",
            body: { password, adminPassword, ...(otp ? { otp } : {}) },
          },
        ),
      );
      return json({ owner, temporaryPassword: password }, 201);
    } catch (e) {
      const reason = e instanceof ApiError ? e.message : "Lỗi không xác định.";
      // Tài khoản đã tạo: không trả 401 (sẽ xóa cookie phiên) dù API từ chối mật khẩu quản trị.
      const status = e instanceof ApiError && e.status !== 401 ? e.status : 409;
      throw new ApiError(
        status,
        "OWNER_CREATED_PASSWORD_NOT_SET",
        `Đã tạo tài khoản chủ xe nhưng chưa đặt được mật khẩu tạm (${reason}) Hãy dùng "Đặt mật khẩu tạm" trong danh sách chủ xe.`,
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
