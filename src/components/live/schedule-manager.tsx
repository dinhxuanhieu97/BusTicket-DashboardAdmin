"use client";

import { useEffect, useState } from "react";
import { vnToday, vnDateTime } from "@/lib/live-contracts";
import { operation } from "./operations-client";
import { PairTripForm } from "./pair-trip-form";
import type { TripOptions } from "@/lib/trip-management";

type Schedule = {
  id: string;
  name: string;
  enabled: boolean;
  config: {
    startDate: string;
    departTime: string;
    legs: { routeId: string; name?: string }[];
  };
  last_error: string | null;
  last_success_at: string | null;
};
type Occurrence = {
  date: string;
  leg: number;
  routeId: string;
  vehicleId: string;
  departAt: string;
  skipped: boolean;
  existing: boolean;
};

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [options, setOptions] = useState<TripOptions | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    items: Occurrence[];
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    const result = await operation<{ schedules: Schedule[] }>("trip-schedules");
    setSchedules(result.schedules);
    setLoaded(true);
  }
  useEffect(() => {
    let active = true;
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    void fetch("/api/trip-management/options")
      .then(async (r) => {
        if (r.ok && active) setOptions(await r.json());
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function showPreview(id: string) {
    const result = await operation<{ occurrences: Occurrence[] }>(
      `trip-schedules/${id}/preview`,
    );
    setPreview({ id, items: result.occurrences });
  }
  const active = schedules.find((s) => s.id === preview?.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Duy trì lịch chạy 30 ngày tới. Hai xe đổi chiều mỗi ngày kể từ ngày
          bắt đầu.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Đóng thiết lập" : "+ Thiết lập lịch"}
        </button>
      </div>
      {error && (
        <p role="alert" className="card p-4 text-sm text-amber-500">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="card p-4 text-sm text-emerald-500">
          {notice}
        </p>
      )}
      {creating && (
        <section className="card space-y-4 p-6">
          <h2 className="font-bold">Thiết lập lịch hai chiều</h2>
          <PairTripForm
            mode="daily"
            onSaved={() => {
              setCreating(false);
              void run(async () => {
                await load();
                setNotice(
                  "Đã lưu lịch chưa bật. Chọn Xem trước để kiểm tra lịch.",
                );
              });
            }}
          />
        </section>
      )}
      {!loaded && !error && (
        <p className="text-sm text-muted">Đang tải lịch…</p>
      )}
      {loaded && !schedules.length && !creating && (
        <p className="card p-8 text-center text-muted">Chưa có lịch tự động.</p>
      )}
      {schedules.map((s) => (
        <section
          key={s.id}
          className="card flex flex-wrap items-center justify-between gap-4 p-5"
        >
          <div>
            <h2 className="font-bold">{s.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {s.config.startDate} · {s.config.departTime} ·{" "}
              {s.enabled ? "Đang bật" : "Đang tắt"}
            </p>
            {s.last_success_at && (
              <p className="mt-1 text-xs text-muted">
                Cập nhật {vnDateTime(s.last_success_at)}
              </p>
            )}
            {s.last_error && (
              <p className="mt-1 text-sm text-amber-500">{s.last_error}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn"
              disabled={busy}
              onClick={() => void run(() => showPreview(s.id))}
            >
              Xem trước
            </button>
            {s.enabled && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await operation(`trip-schedules/${s.id}`, "PATCH", {
                      enabled: false,
                    });
                    await load();
                    setNotice(
                      "Đã tắt tạo chuyến mới. Các chuyến đã tạo vẫn giữ nguyên.",
                    );
                  })
                }
              >
                Tạm dừng tạo chuyến
              </button>
            )}
            {s.enabled && s.last_error && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    try {
                      await operation(
                        `trip-schedules/${s.id}/generate`,
                        "POST",
                        {},
                      );
                    } finally {
                      await load();
                    }
                  })
                }
              >
                Thử tạo lại
              </button>
            )}
          </div>
        </section>
      ))}
      {preview && active && (
        <section className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-bold">Lịch dự kiến · {active.name}</h2>
            {!active.enabled && (
              <button
                className="btn btn-primary"
                disabled={busy || !preview.items.some((i) => !i.skipped)}
                onClick={() =>
                  void run(async () => {
                    await operation(`trip-schedules/${active.id}`, "PATCH", {
                      enabled: true,
                    });
                    try {
                      const result = await operation<{ created: number }>(
                        `trip-schedules/${active.id}/generate`,
                        "POST",
                        {},
                      );
                      setNotice(
                        `Đã bật lịch. Lượt này tạo ${result.created} chuyến mới.`,
                      );
                    } finally {
                      await load();
                    }
                  })
                }
              >
                Bật tự động tạo và mở bán
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Xuất bến</th>
                  <th className="p-2">Chiều</th>
                  <th className="p-2">Xe</th>
                  <th className="p-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((i) => {
                  const route = options?.routes.find((r) => r.id === i.routeId),
                    vehicle = options?.vehicles.find(
                      (v) => v.id === i.vehicleId,
                    );
                  return (
                    <tr
                      className="border-t border-line"
                      key={i.date + ":" + i.leg}
                    >
                      <td className="p-2">{vnDateTime(i.departAt)}</td>
                      <td className="p-2">
                        {route
                          ? `${route.origin} → ${route.destination}`
                          : active.config.legs[i.leg]?.name ||
                            `Chiều ${i.leg + 1}`}
                      </td>
                      <td className="p-2">
                        {vehicle
                          ? `${vehicle.code} · ${vehicle.name}`
                          : "Xe không khả dụng"}
                      </td>
                      <td className="p-2">
                        {i.skipped
                          ? "Ngừng chạy"
                          : i.existing
                            ? "Đã tạo"
                            : "Sẽ tạo"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!preview.items.length && (
            <p className="text-sm text-muted">
              Chưa có chuyến trong cửa sổ 30 ngày tới.
            </p>
          )}
          <form
            key={active.id}
            className="space-y-3 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const time = String(f.get("time") || "");
              void run(async () => {
                await operation(
                  `trip-schedules/${active.id}/exception`,
                  "PUT",
                  {
                    date: f.get("date"),
                    leg: Number(f.get("leg")),
                    skipped: f.get("skip") === "on",
                    repositionConfirmed: f.get("reposition") === "on",
                    ...(time ? { departTime: time } : {}),
                  },
                );
                await showPreview(active.id);
                setNotice("Đã lưu ngoại lệ.");
              });
            }}
          >
            <h3 className="font-semibold">Đổi giờ hoặc ngừng chạy một ngày</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="label">
                Ngày
                <input
                  className="field mt-2"
                  type="date"
                  name="date"
                  min={vnToday()}
                  defaultValue={vnToday()}
                  required
                />
              </label>
              <label className="label">
                Chiều
                <select className="field mt-2" name="leg">
                  {active.config.legs.map((l, i) => (
                    <option key={l.routeId} value={i}>
                      {l.name || `Chiều ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                Giờ mới (để trống dùng giờ thường)
                <input className="field mt-2" type="time" name="time" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="skip" />
              Ngừng chạy ngày này
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="reposition" />
              Nếu ngừng chạy: đã bố trí xe về đúng đầu tuyến cho ngày kế tiếp
            </label>
            <p className="text-xs text-muted">
              Ngoại lệ không đổi phân xe ngày khác. Nếu xe không chạy, hãy bố
              trí xe về đúng đầu tuyến cho ngày kế tiếp.
            </p>
            <button className="btn btn-primary" disabled={busy}>
              Lưu ngoại lệ
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
