import { ApiError } from "./access-policy";
export function backendBase() {
  const raw = process.env.PNTICKET_API_URL;
  if (!raw)
    throw new ApiError(
      503,
      "NOT_CONFIGURED",
      "Chưa cấu hình địa chỉ API cho PNTicket.",
    );
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new ApiError(503, "NOT_CONFIGURED", "Cấu hình API không hợp lệ.");
  return url.origin;
}
export async function backendRequest(
  path: string,
  options: {
    token?: string;
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    /** Gửi thân thô (vd. tệp ảnh logo) thay cho JSON. */
    raw?: { data: Uint8Array; type: string };
    idempotencyKey?: string;
    loginProxy?: { key: string; ip: string };
  } = {},
) {
  let res: Response;
  try {
    res = await fetch(backendBase() + path, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.raw
          ? { "Content-Type": options.raw.type }
          : options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
        ...(options.loginProxy
          ? {
              "X-PNTicket-Login-Proxy-Key": options.loginProxy.key,
              "X-PNTicket-Login-Client-Ip": options.loginProxy.ip,
            }
          : {}),
      },
      body: options.raw
        ? new Blob([options.raw.data as BlobPart], { type: options.raw.type })
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      503,
      "BACKEND_UNAVAILABLE",
      "Không kết nối được API PNTicket. Vui lòng thử lại.",
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "API trả về dữ liệu không hợp lệ.",
    );
  }
  if (!res.ok) {
    const error = (body as { error?: { code?: unknown; message?: unknown } })
      ?.error;
    throw new ApiError(
      res.status,
      typeof error?.code === "string" ? error.code : "API_ERROR",
      res.status >= 500
        ? "API đang gặp sự cố. Vui lòng thử lại."
        : typeof error?.message === "string"
          ? error.message
          : "Không thể thực hiện yêu cầu.",
      res.headers.get("retry-after") || undefined,
    );
  }
  return body;
}
