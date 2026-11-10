"use client";
import { useState } from "react";
import type { TripStop } from "@/lib/trip-management";

type Stops = { pickup: TripStop[]; dropoff: TripStop[] };
export function RouteStopsEditor({
  initial,
  onSave,
  busy,
}: {
  initial?: Stops;
  onSave: (stops: Stops) => void;
  busy: boolean;
}) {
  const [stops, setStops] = useState<Stops>(
    initial ?? { pickup: [], dropoff: [] },
  );
  return (
    <form
      className="space-y-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(stops);
      }}
    >
      <p className="text-xs text-muted">
        Chỉ thêm điểm đã biết giờ. Ngày 0 là ngày xuất bến, ngày 1 là hôm sau.
        Sắp xếp theo thứ tự xe chạy.
      </p>
      {(["pickup", "dropoff"] as const).map((kind) => (
        <fieldset
          key={kind}
          className="space-y-2 rounded-xl border border-line p-3"
        >
          <legend className="px-2 text-sm font-semibold">
            {kind === "pickup" ? "Điểm đón" : "Điểm trả"}
          </legend>
          {stops[kind].map((stop, i) => {
            const update = (patch: Partial<TripStop>) =>
              setStops((s) => ({
                ...s,
                [kind]: s[kind].map((v, j) =>
                  j === i ? { ...v, ...patch } : v,
                ),
              }));
            return (
              <div
                key={i}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_auto] sm:items-end"
              >
                <label className="label">
                  Tên điểm
                  <input
                    className="field mt-1"
                    maxLength={160}
                    required
                    value={stop.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label className="label">
                  Giờ
                  <input
                    className="field mt-1"
                    type="time"
                    required
                    value={stop.time}
                    onChange={(e) => update({ time: e.target.value })}
                  />
                </label>
                <label className="label">
                  Ngày
                  <input
                    className="field mt-1"
                    type="number"
                    min={0}
                    max={7}
                    required
                    value={stop.day}
                    onChange={(e) => update({ day: Number(e.target.value) })}
                  />
                </label>
                <button
                  className="btn mb-2"
                  type="button"
                  onClick={() =>
                    setStops((s) => ({
                      ...s,
                      [kind]: s[kind].filter((_, j) => i !== j),
                    }))
                  }
                >
                  Bỏ điểm
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="btn"
            onClick={() =>
              setStops((s) => ({
                ...s,
                [kind]: [...s[kind], { name: "", time: "", day: 0 }],
              }))
            }
          >
            + Thêm {kind === "pickup" ? "điểm đón" : "điểm trả"}
          </button>
        </fieldset>
      ))}
      <button className="btn btn-primary" disabled={busy}>
        Lưu điểm đón/trả
      </button>
    </form>
  );
}
