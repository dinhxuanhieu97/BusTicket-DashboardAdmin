"use client";

import { useEffect, useState } from "react";
import { vnToday, vnDateTime } from "@/lib/live-contracts";
import {
  Notice,
  EmptyState,
  StatusBadge,
  TableScroll,
  LoadState,
  thClass,
  tdClass,
  tableClass,
} from "./shared";
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
    <div className="pn-page-stack">
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
      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {creating && (
        <section className="card space-y-4 pn-panel-inset">
          <h2 className="text-base font-semibold">Thiết lập lịch hai chiều</h2>
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
      {!loaded && !error && <LoadState loading reload={load} />}
      {loaded && !schedules.length && !creating && (
        <section className="card">
          <EmptyState>
            <p>Chưa có lịch tự động.</p>
          </EmptyState>
        </section>
      )}
      {schedules.map((s) => (
        <section
          key={s.id}
          className="card pn-panel-inset flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-base font-semibold wrap-anywhere">
                {s.name}
              </h2>
              <StatusBadge
                tone={s.enabled ? "success" : "neutral"}
                label={s.enabled ? "Đang bật" : "Đang tắt"}
              />
            </div>
            <p className="mt-2 text-sm text-muted tabular-nums">
              {s.config.startDate} · {s.config.departTime}
            </p>
            {s.last_success_at && (
              <p className="mt-1 text-xs text-muted">
                Cập nhật {vnDateTime(s.last_success_at)}
              </p>
            )}
            {s.last_error && (
              <p className="mt-1 text-sm text-warning">{s.last_error}</p>
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
        <section className="card space-y-4 pn-panel-inset">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold">
              Lịch dự kiến · {active.name}
            </h2>
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
          <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
            <TableScroll label="Lịch chạy dự kiến">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Xuất bến</th>
                    <th className={thClass}>Chiều</th>
                    <th className={thClass}>Xe</th>
                    <th className={thClass}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((i) => {
                    const route = options?.routes.find(
                        (r) => r.id === i.routeId,
                      ),
                      vehicle = options?.vehicles.find(
                        (v) => v.id === i.vehicleId,
                      );
                    return (
                      <tr
                        className="border-t border-line"
                        key={i.date + ":" + i.leg}
                      >
                        <td className={tdClass}>{vnDateTime(i.departAt)}</td>
                        <td className={tdClass}>
                          {route
                            ? `${route.origin} → ${route.destination}`
                            : active.config.legs[i.leg]?.name ||
                              `Chiều ${i.leg + 1}`}
                        </td>
                        <td className={tdClass}>
                          {vehicle
                            ? `${vehicle.code} · ${vehicle.name}`
                            : "Xe không khả dụng"}
                        </td>
                        <td className={tdClass}>
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
            </TableScroll>
          </div>
          {!preview.items.length && (
            <p className="text-sm text-muted">
              Chưa có chuyến trong cửa sổ 30 ngày tới.
            </p>
          )}
          <form
            key={active.id}
            className="space-y-4 border-t border-line pt-4"
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
            <div className="pn-form-grid max-w-md sm:grid-cols-2">
              <label className="label">
                Ngày
                <input
                  className="field"
                  type="date"
                  name="date"
                  min={vnToday()}
                  defaultValue={vnToday()}
                  required
                />
              </label>
              <label className="label">
                Giờ mới (để trống dùng giờ thường)
                <input className="field" type="time" name="time" />
              </label>
              <label className="label sm:col-span-2">
                Chiều
                <select className="field" name="leg">
                  {active.config.legs.map((l, i) => (
                    <option key={l.routeId} value={i}>
                      {l.name || `Chiều ${i + 1}`}
                    </option>
                  ))}
                </select>
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
