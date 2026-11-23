import { requirePermission } from "@/lib/access-policy";
import { operatorSession } from "@/lib/server/session";

/** Cấu hình email báo nhà xe: chỉ chủ xe (`alert.configure`). */
export async function alertAccess() {
  const { token, session } = await operatorSession();
  requirePermission(session, "alert.configure");
  return {
    token,
    path: `/api/v1/admin/operators/${session.user.operatorId}/alert-settings`,
  };
}
