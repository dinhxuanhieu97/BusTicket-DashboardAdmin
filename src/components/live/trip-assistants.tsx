"use client";
import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import {
  MAX_ASSISTANTS_PER_TRIP,
  type AssistantRef,
  type TripAssistant,
} from "@/lib/trip-assistants";
import { LoadState, Notice, StatusBadge } from "./shared";

type Loaded = {
  assistants: TripAssistant[];
  candidates: AssistantRef[];
  canAssign: boolean;
};

/** Phân công phụ xe cho chuyến. Người chỉ có `trip.read` xem danh sách; OWNER/Điều hành chọn và lưu. */
export function TripAssistantsSection({
  tripId,
  cancelled,
}: {
  tripId: string;
  cancelled: boolean;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const url = `/api/trip-management/${encodeURIComponent(tripId)}/assistants`;

  useEffect(() => {
    const c = new AbortController();
    setError("");
    fetch(url, { cache: "no-store", signal: c.signal })
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 401) return window.location.replace("/login");
        if (!res.ok)
          throw Error(body.error?.message || "Không tải được phụ xe.");
        setData(body);
        setPicked(body.assistants.map((a: TripAssistant) => a.id));
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Mất kết nối API.");
      });
    return () => c.abort();
  }, [url, revision]);

  const reload = () => setRevision((n) => n + 1);
  const assignedIds = data?.assistants.map((a) => a.id) ?? [];
  const dirty =
    picked.length !== assignedIds.length ||
    picked.some((id) => !assignedIds.includes(id));
  // Phụ xe đã khóa vẫn hiện để người phân công gỡ ra.
  const options: (AssistantRef & { active: boolean })[] = data
    ? [
        ...data.candidates.map((c) => ({ ...c, active: true })),
        ...data.assistants
          .filter((a) => !a.active)
          .map((a) => ({ ...a, active: false })),
      ]
    : [];

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: picked }),
      });
      const body = await res.json();
      if (res.status === 401) return window.location.replace("/login");
      if (!res.ok)
        throw Error(body.error?.message || "Không lưu được phân công.");
      setData((d) => (d ? { ...d, assistants: body.assistants } : d));
      setPicked(body.assistants.map((a: TripAssistant) => a.id));
      setMessage({ tone: "success", text: "Đã lưu phân công phụ xe." });
    } catch (e) {
      setMessage({
        tone: "danger",
        text: e instanceof Error ? e.message : "Mất kết nối API.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="assistant-heading"
      className="rounded-xl border border-line/60 bg-surface/20 p-4"
    >
      <h3
        id="assistant-heading"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <UserCheck size={16} aria-hidden="true" /> Phụ xe phụ trách
      </h3>
      {error && <LoadState error={error} reload={reload} />}
      {!data && !error && (
        <p className="mt-2 text-sm text-muted" role="status">
          Đang tải phụ xe…
        </p>
      )}
      {data && !data.canAssign && (
        <div className="mt-2 text-sm">
          {data.assistants.length ? (
            <ul className="flex flex-wrap gap-2">
              {data.assistants.map((a) => (
                <li key={a.id}>
                  <StatusBadge
                    tone={a.active ? "info" : "neutral"}
                    label={`${a.fullName} · ${a.phone}${a.active ? "" : " (đã khóa)"}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Chưa giao phụ xe.</p>
          )}
        </div>
      )}
      {data && data.canAssign && (
        <div className="mt-3 space-y-3">
          {cancelled ? (
            <Notice tone="warning">
              Chuyến đã hủy, không phân công phụ xe.
            </Notice>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted">
              Nhà xe chưa có tài khoản phụ xe đang hoạt động. Tạo ở mục Nhân
              viên với vai trò Phụ xe.
            </p>
          ) : (
            <fieldset>
              <legend className="mb-2 text-xs text-muted">
                Chọn tối đa {MAX_ASSISTANTS_PER_TRIP} phụ xe. Phụ xe chỉ thấy
                chuyến được giao và danh sách khách của chuyến đó.
              </legend>
              <ul className="grid gap-2 sm:grid-cols-2">
                {options.map((o) => {
                  const checked = picked.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line/60 p-2.5 text-sm hover:bg-surface/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            saving ||
                            (!checked &&
                              (!o.active ||
                                picked.length >= MAX_ASSISTANTS_PER_TRIP))
                          }
                          onChange={(e) =>
                            setPicked((p) =>
                              e.target.checked
                                ? [...p, o.id]
                                : p.filter((id) => id !== o.id),
                            )
                          }
                        />
                        <span className="font-medium text-ink">
                          {o.fullName}
                        </span>
                        <span className="text-xs text-muted">{o.phone}</span>
                        {!o.active && (
                          <StatusBadge tone="neutral" label="Đã khóa" />
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          {!cancelled && options.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!dirty || saving}
                onClick={() => void save()}
              >
                {saving ? "Đang lưu…" : "Lưu phân công"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
