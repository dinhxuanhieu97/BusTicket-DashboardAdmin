"use client";
import { useEffect, useState } from "react";
export function useResource<T>(path: string) {
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ path, data: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ path, data: null, error: "", loading: true });
    void (async () => {
      try {
        const res = await fetch("/api/live/" + path, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await res.json();
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          window.location.replace("/login");
          return;
        }
        if (body.error?.code === "MFA_SETUP_REQUIRED") {
          window.location.replace("/mfa");
          return;
        }
        if (body.error?.code === "OWNER_REQUIRED") {
          window.location.replace("/login");
          return;
        }
        if (!res.ok)
          throw new Error(body.error?.message || "Không tải được dữ liệu.");
        setResult({ path, data: body, error: "", loading: false });
      } catch (e) {
        if (!controller.signal.aborted)
          setResult({
            path,
            data: null,
            error: e instanceof Error ? e.message : "Mất kết nối API.",
            loading: false,
          });
      }
    })();
    return () => controller.abort();
  }, [path, revision]);
  return {
    data: result.path === path ? result.data : null,
    error: result.path === path ? result.error : "",
    loading: result.path !== path || result.loading,
    reload: () => setRevision((n) => n + 1),
  };
}
