import "server-only";
import { ApiError } from "../access-policy";
import { ownerSession } from "./session";
export async function pageAccess() {
  try {
    return { ok: true as const, ...(await ownerSession(true)) };
  } catch (e) {
    return {
      ok: false as const,
      status: e instanceof ApiError ? e.status : 502,
      message:
        e instanceof ApiError
          ? e.message
          : "Không đọc được phiên đăng nhập. Vui lòng thử lại.",
    };
  }
}
