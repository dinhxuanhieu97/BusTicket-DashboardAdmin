"use client";
import { useEffect, useState } from "react";

/** Phiên hết hạn / cần 2FA / đổi mật khẩu: chuyển trang và trả `null` (không coi là lỗi). */
class Redirected extends Error {}

async function fetchLive(path: string, signal: AbortSignal) {
  const res = await fetch("/api/live/" + path, { cache: "no-store", signal });
  const body = await res.json();
  const go = (to: string) => {
    window.location.replace(to);
    throw new Redirected();
  };
  if (res.status === 401) go("/login");
  if (body.error?.code === "MFA_SETUP_REQUIRED") go("/mfa");
  if (body.error?.code === "PASSWORD_CHANGE_REQUIRED") go("/change-password");
  if (body.error?.code === "OPERATOR_REQUIRED") go("/login");
  if (!res.ok)
    throw new Error(body.error?.message || "Không tải được dữ liệu.");
  return body;
}

type State<T> = {
  path: string | null;
  data: T | null;
  error: string;
  loading: boolean;
};

function useLive<T>(
  path: string | null,
  load: (path: string, signal: AbortSignal) => Promise<T>,
) {
  const [result, setResult] = useState<State<T>>({
    path,
    data: null,
    error: "",
    loading: path !== null,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    setResult({ path, data: null, error: "", loading: true });
    void (async () => {
      try {
        const data = await load(path, controller.signal);
        if (!controller.signal.aborted)
          setResult({ path, data, error: "", loading: false });
      } catch (e) {
        if (controller.signal.aborted || e instanceof Redirected) return;
        setResult({
          path,
          data: null,
          error: e instanceof Error ? e.message : "Mất kết nối API.",
          loading: false,
        });
      }
    })();
    return () => controller.abort();
    // `load` là hàm cố định của từng hook bên dưới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, revision]);
  return {
    data: result.path === path ? result.data : null,
    error: result.path === path ? result.error : "",
    loading: path !== null && (result.path !== path || result.loading),
    reload: () => setRevision((n) => n + 1),
  };
}

/** `path = null`: không tải (vd. người dùng không có quyền xem tài nguyên đó). */
export function useResource<T>(path: string | null) {
  return useLive<T>(path, fetchLive);
}

/**
 * Tải hết các trang theo `nextCursor` (API chuyến trả tối đa 100 chuyến/lần), gộp `trips`.
 * Dừng ở `maxPages` trang; khi đó `nextCursor` còn giá trị để giao diện ghi "ít nhất".
 */
export function useAllTrips<
  T extends { trips: unknown[]; nextCursor?: string | null },
>(path: string | null, maxPages = 10) {
  return useLive<T>(path, async (p, signal) => {
    let page = (await fetchLive(p, signal)) as T;
    const trips = [...page.trips];
    for (let i = 1; i < maxPages && page.nextCursor; i++) {
      page = (await fetchLive(
        `${p}&cursor=${encodeURIComponent(page.nextCursor)}`,
        signal,
      )) as T;
      trips.push(...page.trips);
    }
    return { ...page, trips } as T;
  });
}
