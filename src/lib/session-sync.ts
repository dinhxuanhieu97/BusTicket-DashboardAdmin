/**
 * Đồng bộ trạng thái đăng nhập giữa các tab cùng trình duyệt.
 * Chỉ phát "có thay đổi" (login/logout/mfa) — không bao giờ gửi token hay thông tin người dùng.
 * Tab nhận tin luôn hỏi lại máy chủ (`/api/auth/session`) rồi mới đổi giao diện.
 */
export type SessionEventType = "login" | "logout" | "mfa";
export type SessionEvent = { type: SessionEventType; at: number; id: string };

export const CHANNEL = "pnticket-session";
/** Khóa localStorage dự phòng khi trình duyệt không có BroadcastChannel. */
export const STORAGE_KEY = "pnticket_session_event";
const TYPES: readonly string[] = ["login", "logout", "mfa"];

/** Kiểm tra tin nhận được; bỏ qua mọi thứ không đúng dạng (tin giả từ extension, dữ liệu cũ). */
export function parseSessionEvent(raw: unknown): SessionEvent | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  if (
    typeof e.type !== "string" ||
    !TYPES.includes(e.type) ||
    typeof e.at !== "number" ||
    typeof e.id !== "string" ||
    Object.keys(e).length !== 3
  )
    return null;
  return { type: e.type as SessionEventType, at: e.at, id: e.id };
}

/** Id các tin tab này đã phát: BroadcastChannel giao cả cho kênh khác trong cùng tab, nên phải tự bỏ qua. */
const published = new Set<string>();

function makeEvent(type: SessionEventType): SessionEvent {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Math.random()).slice(2);
  return { type, at: Date.now(), id };
}

/** Báo các tab khác rằng phiên vừa đổi. Không ném lỗi (trình duyệt chặn storage vẫn đăng nhập bình thường). */
export function publishSessionEvent(type: SessionEventType) {
  const event = makeEvent(type);
  published.add(event.id);
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage(event);
      ch.close();
      return;
    }
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** Lắng nghe thay đổi phiên từ tab khác; trả hàm hủy. */
export function subscribeSessionEvents(onEvent: (e: SessionEvent) => void) {
  const seen = new Set<string>();
  const deliver = (raw: unknown) => {
    const e = parseSessionEvent(raw);
    if (!e || seen.has(e.id) || published.has(e.id)) return;
    seen.add(e.id);
    onEvent(e);
  };
  let ch: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (m) => deliver(m.data);
    }
  } catch {}
  const storage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) deliver(e.newValue);
  };
  window.addEventListener("storage", storage);
  return () => {
    ch?.close();
    window.removeEventListener("storage", storage);
  };
}
