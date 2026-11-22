"use client";
import { useState } from "react";
import type { TripStop } from "@/lib/trip-management";
import { prepareStops, type RouteStops } from "@/lib/route-stops";
import { Notice } from "./shared";

type Kind = "pickup" | "dropoff";
const kindLabel = { pickup: "Điểm đón", dropoff: "Điểm trả" } as const;
const timeLabel = {
  pickup: "Giờ đón dự kiến",
  dropoff: "Giờ trả dự kiến",
} as const;

/**
 * Thêm/sửa/bỏ điểm đón/trả của một tuyến (RT5, RT6). Giờ chỉ là dự kiến: nhà xe gọi khách trước khi tới
 * điểm đón. Khi lưu, điểm tự sắp theo ngày/giờ (API chỉ nhận danh sách đúng thứ tự xe chạy).
 */
export function RouteStopsEditor({
  initial,
  onSave,
  busy,
}: {
  initial?: RouteStops;
  onSave: (stops: RouteStops) => void;
  busy: boolean;
}) {
  const [stops, setStops] = useState<RouteStops>(
    initial ?? { pickup: [], dropoff: [] },
  );
  const [confirming, setConfirming] = useState<{
    kind: Kind;
    index: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = (kind: Kind, index: number) => {
    setStops((s) => ({ ...s, [kind]: s[kind].filter((_, j) => j !== index) }));
    setConfirming(null);
  };

  return (
    <form
      className="space-y-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        const prepared = prepareStops(stops);
        if (!prepared.ok) {
          setError(prepared.error);
          return;
        }
        setError(null);
        setConfirming(null);
        setStops(prepared.stops);
        onSave(prepared.stops);
      }}
    >
      <div className="space-y-1 text-xs text-muted">
        <p>
          Giờ là giờ dự kiến: nhà xe gọi khách trước vài giờ để báo giờ đón
          chính xác. Ngày 0 là ngày xuất bến, ngày 1 là hôm sau.
        </p>
        <p>
          Thêm điểm theo thứ tự nào cũng được, khi lưu các điểm tự sắp theo giờ.
          Thay đổi áp dụng cho mọi chuyến chưa khởi hành của tuyến; vé đã đặt
          giữ điểm khách đã chọn.
        </p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {(["pickup", "dropoff"] as const).map((kind) => (
        <fieldset
          key={kind}
          className="space-y-4 rounded-xl border border-line p-4"
        >
          <legend className="px-2 text-sm font-semibold">
            {kindLabel[kind]}
          </legend>
          {stops[kind].map((stop, i) => {
            const update = (patch: Partial<TripStop>) =>
              setStops((s) => ({
                ...s,
                [kind]: s[kind].map((v, j) =>
                  j === i ? { ...v, ...patch } : v,
                ),
              }));
            const name = stop.name.trim();
            const asking = confirming?.kind === kind && confirming.index === i;
            return (
              <div
                key={i}
                className="pn-form-grid grid-cols-2 border-b border-line pb-4 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_auto]"
              >
                <label className="label col-span-2 sm:col-span-1">
                  Tên điểm
                  <input
                    className="field"
                    maxLength={160}
                    required
                    value={stop.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label className="label">
                  {timeLabel[kind]}
                  <input
                    className="field"
                    type="time"
                    required
                    value={stop.time}
                    onChange={(e) => update({ time: e.target.value })}
                  />
                </label>
                <label className="label">
                  Ngày
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={7}
                    required
                    value={stop.day}
                    onChange={(e) => update({ day: Number(e.target.value) })}
                  />
                </label>
                {asking ? (
                  <div
                    role="group"
                    aria-label={`Xác nhận bỏ điểm ${name}`}
                    className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-4"
                  >
                    <span className="text-sm">
                      Bỏ {kindLabel[kind].toLowerCase()} “{name}”?
                    </span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setConfirming(null)}
                    >
                      Giữ điểm
                    </button>
                    <button
                      type="button"
                      className="btn pn-tone"
                      data-tone="danger"
                      onClick={() => remove(kind, i)}
                    >
                      Bỏ điểm này
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn col-span-2 justify-self-end sm:col-span-1"
                    type="button"
                    aria-label={name ? `Bỏ điểm ${name}` : "Bỏ điểm mới"}
                    onClick={() =>
                      // Dòng mới chưa nhập tên thì bỏ luôn, không cần hỏi.
                      name ? setConfirming({ kind, index: i }) : remove(kind, i)
                    }
                  >
                    Bỏ điểm
                  </button>
                )}
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
            + Thêm {kindLabel[kind].toLowerCase()}
          </button>
        </fieldset>
      ))}
      <button className="btn btn-primary" disabled={busy}>
        Lưu điểm đón/trả
      </button>
    </form>
  );
}
