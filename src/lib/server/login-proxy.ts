import "server-only";
import { isIP } from "node:net";
import { ApiError } from "@/lib/access-policy";

/**
 * IP thật của người dùng gửi kèm khóa proxy, để API giới hạn số lần thử theo từng người chứ không theo máy chủ
 * dashboard. Chưa cấu hình (local) → không gửi, API dùng IP kết nối.
 */
export function loginProxyFor(req: Request) {
  const key = process.env.PNTICKET_LOGIN_PROXY_KEY;
  const header = process.env.PNTICKET_TRUSTED_CLIENT_IP_HEADER;
  if (!key && !header) return undefined;
  const ip = header ? req.headers.get(header) : null;
  if (!key || key.length < 32 || !ip || !isIP(ip))
    throw new ApiError(
      503,
      "NOT_CONFIGURED",
      "Chưa xác minh được nguồn đăng nhập.",
    );
  return { key, ip };
}
