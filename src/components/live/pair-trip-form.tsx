"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  parseFareThousands,
  type TripOptions,
  vnInputToISO,
} from "@/lib/trip-management";
import { vnToday, vnDateTime, vnd } from "@/lib/live-contracts";
import { operation } from "./operations-client";
import { tripMutation } from "./trip-editor";
import { FareFields } from "./fare-fields";
import type { OperatorProfile } from "./general-information";

export function PairTripForm({
  mode,
  date,
  onSaved,
}: {
  mode: "once" | "daily";
  date?: string;
  onSaved: (date: string) => void;
}) {
  const [options, setOptions] = useState<TripOptions | null>(null),
    [routeId, setRouteId] = useState("");
  const [vehicleIds, setVehicleIds] = useState(["", ""]),
    [names, setNames] = useState(["", ""]);
  const [start, setStart] = useState(date ?? vnToday()),
    [time, setTime] = useState("17:30"),
    [arrival, setArrival] = useState("07:00");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const key = useRef("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/trip-management/options");
        const data = await response.json();
        if (!response.ok) throw Error(data.error?.message);
        if (!active) return;
        setOptions(data);
        setRouteId(data.routes[0]?.id ?? "");
        setVehicleIds(
          data.vehicles
            .filter((v: { usable: boolean }) => v.usable)
            .slice(0, 2)
            .map((v: { id: string }) => v.id),
        );
        const profile = await operation<OperatorProfile>("profile");
        if (active) setTime(profile.defaultDepartureTime);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const outward = options?.routes.find((r) => r.id === routeId);
  const normalize = (v: string) => v.trim().toLocaleLowerCase("vi");
  const inward =
    outward &&
    options?.routes.find(
      (r) =>
        r.id !== outward.id &&
        normalize(r.origin) === normalize(outward.destination) &&
        normalize(r.destination) === normalize(outward.origin),
    );
  const routes = [outward, inward];
  const selected = vehicleIds.map((id) =>
    options?.vehicles.find((v) => v.id === id),
  );
  const nameFor = (i: number) =>
    names[i]?.trim() ||
    `Chuyến ${routes[i]?.origin ?? ""} → ${routes[i]?.destination ?? ""}`;
  const faresFor = (i: number) =>
    (selected[i]?.fares ?? []).map((f) => {
      const raw = prices[`${vehicleIds[i]}:${f.floor}:${f.occupancy}`] ?? "";
      const price = parseFareThousands(raw);
      if (price === null)
        throw Error("Nhập đủ giá vé từ 0 đến 20.000 nghìn đồng cho mỗi xe.");
      return { floor: f.floor, occupancy: f.occupancy, price };
    });
  const validate = () => {
    if (!outward || !inward)
      throw Error(
        "Cần cấu hình đủ hai tuyến ngược chiều tại Cài đặt → Thông tin chung.",
      );
    if (
      !selected[0]?.usable ||
      !selected[1]?.usable ||
      vehicleIds[0] === vehicleIds[1]
    )
      throw Error("Chọn hai xe khác nhau có sơ đồ khả dụng.");
    if (new Date(vnInputToISO(`${start}T${time}`)).getTime() <= Date.now())
      throw Error("Chọn ngày bắt đầu và giờ trong tương lai.");
    faresFor(0);
    faresFor(1);
  };
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      validate();
      if (mode === "daily") {
        await operation(
          "trip-schedules",
          "POST",
          {
            name: `${outward!.origin} ↔ ${outward!.destination}`,
            startDate: start,
            departTime: time,
            arrivalTime: arrival,
            turnaroundMinutes: 60,
            legs: routes.map((r, i) => ({
              routeId: r!.id,
              name: nameFor(i),
              vehicles: [i, 1 - i].map((j) => ({
                vehicleId: vehicleIds[j],
                fares: faresFor(j),
              })),
            })),
          },
          key.current,
        );
      } else {
        const departAt = vnInputToISO(`${start}T${time}`);
        await tripMutation(
          "/batch",
          "POST",
          {
            trips: routes.map((r, i) => ({
              routeId: r!.id,
              vehicleId: vehicleIds[i],
              name: nameFor(i),
              departAt,
              salesOpenAt: openAt.current,
              salesCloseAt: departAt,
              fares: faresFor(i),
              status: "DRAFT",
            })),
          },
          key.current,
        );
      }
      onSaved(start);
    } catch (e) {
      setError((e as Error).message);
      setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  // Freeze the reviewed payload including sales-open time across retries.
  const openAt = useRef("");
  return (
    <div className="pn-page-stack">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-amber-500/10 p-3 text-sm text-warning"
        >
          {error}
        </p>
      )}
      {!options && !error && <p>Đang tải tuyến và xe…</p>}
      {options && (
        <>
          <p className="text-sm text-muted">
            Cả hai chiều · Giờ Việt Nam.{" "}
            {mode === "daily"
              ? "Hai xe đổi chiều mỗi ngày, tính từ ngày bắt đầu."
              : "Tạo hai chuyến nháp cùng lúc, sau đó kiểm tra và mở bán."}
          </p>
          {review ? (
            <div className="card pn-panel-inset space-y-4">
              <h3 className="text-base font-semibold">
                Kiểm tra trước khi lưu
              </h3>
              <p>
                {start} · Xuất bến {time}
                {mode === "daily" && ` · Đến ${arrival} hôm sau`}
              </p>
              {routes.map((r, i) => (
                <div key={i}>
                  <strong>{nameFor(i)}</strong>
                  <p className="text-sm text-muted">
                    {r?.origin} → {r?.destination} · {selected[i]?.code} ·{" "}
                    {selected[i]?.name}
                  </p>
                  <ul className="text-sm">
                    {faresFor(i).map((f) => (
                      <li key={`${f.floor}:${f.occupancy}`}>
                        Tầng {f.floor} · {f.occupancy} người: {vnd(f.price)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-muted">
                {mode === "daily"
                  ? "Lưu cấu hình chưa bật. Bạn sẽ xem trước tối đa 30 ngày rồi chủ động bật tự tạo và mở bán. Thời gian quay đầu tối thiểu 60 phút."
                  : "Hai chuyến được lưu trong cùng giao dịch; nếu có lỗi, cả hai không được tạo."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setReview(false);
                    setUncertain(false);
                  }}
                >
                  Quay lại sửa
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy
                    ? "Đang lưu…"
                    : uncertain
                      ? "Gửi lại yêu cầu"
                      : mode === "daily"
                        ? "Lưu lịch chưa bật"
                        : "Xác nhận tạo hai chuyến"}
                </button>
              </div>
            </div>
          ) : (
            <form
              className="pn-page-stack"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  validate();
                  key.current = crypto.randomUUID();
                  openAt.current = new Date().toISOString();
                  setReview(true);
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label className="label max-w-lg">
                Chiều xuất phát đầu tiên
                <select
                  className="field"
                  value={routeId}
                  onChange={(e) => {
                    setRouteId(e.target.value);
                    setNames(["", ""]);
                  }}
                >
                  {options.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.origin} → {r.destination}
                    </option>
                  ))}
                </select>
              </label>
              {!inward && (
                <p className="text-sm text-warning">
                  Chưa có tuyến ngược.{" "}
                  <Link
                    className="underline"
                    href="/admin/settings?tab=general"
                  >
                    Cấu hình hai chiều
                  </Link>
                </p>
              )}
              <fieldset className="rounded-xl border border-line p-4">
                <legend className="px-2 text-sm font-semibold">
                  Thời gian chạy
                </legend>
                <div className="pn-form-grid max-w-md sm:grid-cols-2">
                  <label className="label">
                    {mode === "daily"
                      ? "Ngày bắt đầu phân xe"
                      : "Ngày khởi hành"}
                    <input
                      required
                      type="date"
                      className="field"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <label className="label">
                    Giờ xuất bến
                    <input
                      required
                      type="time"
                      className="field"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </label>
                  {mode === "daily" && (
                    <label className="label">
                      Giờ đến hôm sau
                      <input
                        required
                        type="time"
                        className="field"
                        value={arrival}
                        onChange={(e) => setArrival(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              </fieldset>
              {routes.map((r, i) => (
                <fieldset
                  key={i}
                  className="space-y-4 rounded-xl border border-line p-4"
                >
                  <legend className="px-2 text-sm font-semibold">
                    {r
                      ? `${r.origin} → ${r.destination}`
                      : "Chiều ngược chưa cấu hình"}
                  </legend>
                  <div className="pn-form-grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <label className="label">
                      {mode === "daily"
                        ? "Xe tại đầu tuyến vào ngày bắt đầu"
                        : "Xe"}
                      <select
                        required
                        className="field"
                        value={vehicleIds[i] ?? ""}
                        onChange={(e) =>
                          setVehicleIds((ids) =>
                            ids.map((v, j) => (j === i ? e.target.value : v)),
                          )
                        }
                      >
                        <option value="">Chọn xe</option>
                        {options.vehicles
                          .filter((v) => v.usable)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.code} · {v.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="label">
                      Tên chuyến (tự điền nếu bỏ trống)
                      <input
                        className="field"
                        maxLength={120}
                        placeholder={nameFor(i)}
                        value={names[i]}
                        onChange={(e) =>
                          setNames((values) =>
                            values.map((v, j) =>
                              j === i ? e.target.value : v,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <FareFields
                    fares={selected[i]?.fares ?? []}
                    valueFor={(key) => prices[`${vehicleIds[i]}:${key}`] ?? ""}
                    onChange={(key, value) =>
                      setPrices((current) => ({
                        ...current,
                        [`${vehicleIds[i]}:${key}`]: value,
                      }))
                    }
                  />
                </fieldset>
              ))}
              <button className="btn btn-primary" disabled={!inward}>
                Xem lại cấu hình
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
