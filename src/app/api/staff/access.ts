import "server-only";
import { ApiError } from "@/lib/access-policy";
import { operatorSession } from "@/lib/server/session";

export async function staffAccess() {
  const { token, session } = await operatorSession();
  if (!session.permissions?.includes("user.manage")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Bạn không có quyền quản lý nhân viên.",
    );
  }
  return {
    token,
    viewerId: session.user.id,
    path: `/api/v1/admin/operators/${session.user.operatorId}/users`,
  };
}

export function rejectStaffQuery(request: Request) {
  if (new URL(request.url).searchParams.size) {
    throw new ApiError(400, "VALIDATION_FAILED", "Tham số không được hỗ trợ.");
  }
}
