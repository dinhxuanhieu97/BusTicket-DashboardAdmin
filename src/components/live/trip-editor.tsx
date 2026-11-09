"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../modal";
import {
  type TripOptions,
  createTripInput,
  vnInputToISO,
} from "@/lib/trip-management";
import { vnDateTime, vnd, type Trip } from "@/lib/live-contracts";
import { PN_SCHEDULE } from "@/lib/trip-detail";
export { TripDetails } from "./trip-details";
export async function tripMutation(
  path: string,
  method: string,
  body: unknown,
  idempotencyKey?: string,
) {
  const res = await fetch("/api/trip-management" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Không thể lưu chuyến.");
  return data;
}
export function TripEditor({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const [options, setOptions] = useState<TripOptions | null>(null),
    [loadError, setLoadError] = useState("");
  const [route, setRoute] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  // Giờ chạy mặc định PN: xuất bến 17:30, tới nơi 07:00 sáng hôm sau.
  const [depart, setDepart] = useState(`${date}T${PN_SCHEDULE.depart}`),
    [open, setOpen] = useState(date + "T00:00"),
    [close, setClose] = useState(`${date}T${PN_SCHEDULE.depart}`);
  const [prices, setPrices] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [review, setReview] = useState<ReturnType<
    typeof createTripInput.parse
  > | null>(null);
  const lock = useRef(false);
  // Một khóa cho mỗi lần xác nhận: gửi lại (kể cả từ tab khác bị mất phản hồi) không tạo trùng chuyến.
  const requestKey = useRef("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/trip-management/options", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error?.message || "Không tải được tuyến/xe.");
        setOptions(b);
      })
      .catch((e) => {
        if (!c.signal.aborted) setLoadError(e.message);
      });
    return () => c.abort();
  }, []);
  const selected = options?.vehicles.find((v) => v.id === vehicle);
  const prepare = (status: "DRAFT" | "OPEN") => {
    setError("");
    try {
      const fares = (selected?.fares ?? []).map((f) => {
        const raw = prices[`${f.floor}:${f.occupancy}`] ?? "";
        if (!/^\d+$/.test(raw))
          throw Error(
            "Nhập đầy đủ giá vé VND nguyên, không dùng dấu phân cách.",
          );
        return { floor: f.floor, occupancy: f.occupancy, price: Number(raw) };
      });
      const data = createTripInput.safeParse({
        routeId: route,
        vehicleId: vehicle,
        name,
        ...(phone.trim() ? { contactPhone: phone.trim() } : {}),
        departAt: vnInputToISO(depart),
        salesOpenAt: vnInputToISO(open),
        salesCloseAt: vnInputToISO(close),
        fares,
        status,
      });
      if (!data.success)
        throw Error(
          "Kiểm tra tuyến, xe, tên, số liên hệ và giá VND (0–20.000.000). Thời gian phải thỏa: mở bán < đóng bán ≤ khởi hành.",
        );
      if (Date.parse(data.data.departAt) <= Date.now())
        throw Error("Chọn giờ khởi hành trong tương lai.");
      requestKey.current = crypto.randomUUID();
      setReview(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thông tin không hợp lệ.");
    }
  };
  return (
    <Modal
      title="Thêm chuyến xe"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="mb-4 text-sm text-muted">
        Giờ Việt Nam (UTC+7) · Giá vé VND. Dữ liệu sẽ được lưu vào nhà xe của
        bạn.
      </p>
      {loadError && <p role="alert">{loadError} Đóng và mở lại để tải lại.</p>}
      {!options && !loadError && <p>Đang tải tuyến và xe…</p>}
      {options &&
        (!options.routes.length || !options.vehicles.some((v) => v.usable)) && (
          <p role="alert">
            Chưa có tuyến hoặc xe hoạt động với sơ đồ khả dụng. Cần cấu hình
            tuyến/xe trước khi tạo chuyến.
          </p>
        )}
      {options && !review && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            prepare("DRAFT");
          }}
          className="space-y-4"
        >
          <label className="label">
            Tuyến
            <select
              className="field mt-2"
              required
              aria-label="Tuyến"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            >
              <option value="">Chọn tuyến</option>
              {options.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.origin} → {r.destination}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Xe
            <select
              className="field mt-2"
              required
              aria-label="Xe"
              value={vehicle}
              onChange={(e) => {
                setVehicle(e.target.value);
                setPrices({});
              }}
            >
              <option value="">Chọn xe</option>
              {options.vehicles.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.usable}>
                  {v.code} · {v.name} · {v.layoutName}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Tên chuyến
            <input
              className="field mt-2"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="label">
            Số điện thoại liên hệ (tùy chọn)
            <input
              className="field mt-2"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted">
            Mặc định PN: xuất bến {PN_SCHEDULE.depart}, tới nơi{" "}
            {PN_SCHEDULE.arrive} sáng hôm sau. Ngày lễ tết có thể khác.
          </p>
          {[
            { label: "Khởi hành", value: depart, set: setDepart },
            { label: "Mở bán từ", value: open, set: setOpen },
            { label: "Đóng bán lúc", value: close, set: setClose },
          ].map((f) => (
            <label className="label" key={f.label}>
              {f.label}
              <input
                className="field mt-2"
                type="datetime-local"
                required
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              />
            </label>
          ))}
          {selected?.fares.map((f) => {
            const key = `${f.floor}:${f.occupancy}`;
            return (
              <label className="label" key={key}>
                Giá {f.label} (VND)
                <input
                  className="field mt-2"
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="20000000"
                  step="1"
                  required
                  value={prices[key] ?? ""}
                  onChange={(e) =>
                    setPrices({ ...prices, [key]: e.target.value })
                  }
                />
              </label>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn"
              disabled={!selected?.usable || uncertain}
              type="submit"
            >
              Lưu nháp
            </button>
            <button
              className="btn bg-accent text-white"
              disabled={!selected?.usable || uncertain}
              type="button"
              onClick={() => prepare("OPEN")}
            >
              Tạo và mở bán
            </button>
          </div>
        </form>
      )}
      {review && (
        <div className="space-y-4">
          <h3 className="font-bold">
            Kiểm tra trước khi{" "}
            {review.status === "DRAFT" ? "lưu nháp" : "mở bán"}
          </h3>
          <p>{review.name}</p>
          <p>
            {options?.routes.find((r) => r.id === review.routeId)?.code} ·{" "}
            {selected?.code} · {selected?.name}
          </p>
          <p>Khởi hành: {vnDateTime(review.departAt)}</p>
          <p>Mở bán: {vnDateTime(review.salesOpenAt)}</p>
          <p>Đóng bán: {vnDateTime(review.salesCloseAt)}</p>
          {review.fares.map((f) => (
            <p key={`${f.floor}:${f.occupancy}`}>
              Tầng {f.floor} · {f.occupancy} người: {vnd(f.price)}
            </p>
          ))}
          {review.status === "OPEN" && (
            <p className="text-sm text-amber-500">
              Chuyến sẽ nhận đặt vé trong khung giờ bán đã chọn.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn"
              disabled={busy || uncertain}
              onClick={() => setReview(null)}
            >
              Quay lại chỉnh
            </button>
            <button
              className="btn bg-accent text-white"
              disabled={busy}
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  await tripMutation("", "POST", review, requestKey.current);
                  onSaved(depart.slice(0, 10));
                } catch (e) {
                  setUncertain(true);
                  setError(
                    (e instanceof Error ? e.message : "Không thể lưu.") +
                      " Chưa xác nhận được kết quả. Bấm xác nhận lần nữa để gửi lại an toàn (cùng mã yêu cầu, không tạo trùng chuyến), hoặc đóng và làm mới danh sách.",
                  );
                } finally {
                  setBusy(false);
                  lock.current = false;
                }
              }}
            >
              {busy
                ? "Đang lưu…"
                : uncertain
                  ? "Gửi lại an toàn"
                  : review.status === "DRAFT"
                    ? "Xác nhận lưu nháp"
                    : "Xác nhận tạo và mở bán"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-amber-500">
          {error}
        </p>
      )}
    </Modal>
  );
}
export function TripStatusDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: Trip;
  onClose: () => void;
  onSaved: () => void;
}) {
  const status = trip.status === "OPEN" ? "CLOSED" : "OPEN",
    label = status === "OPEN" ? "Mở bán" : "Đóng bán";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <Modal
      title={`${label} chuyến xe`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="font-bold">{trip.name}</p>
      <p className="mt-2 text-sm">
        {vnDateTime(trip.depart_at)} · {trip.vehicle_code}
      </p>
      <p className="my-4 text-sm text-muted">
        {status === "CLOSED"
          ? "Ngừng nhận đặt vé mới. Các vé đã đặt được giữ nguyên."
          : "Cho phép nhận đặt vé trong thời gian mở/đóng bán của chuyến."}
      </p>
      {error && (
        <p role="alert" className="mb-4 text-amber-500">
          {error}
        </p>
      )}
      <button
        className="btn bg-accent text-white"
        disabled={busy || !!error}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          try {
            await tripMutation(`/${trip.id}/status`, "PATCH", { status });
            onSaved();
          } catch (e) {
            setError(
              (e instanceof Error ? e.message : "Không thể cập nhật.") +
                " Đóng và làm mới danh sách để kiểm tra trạng thái.",
            );
          } finally {
            setBusy(false);
            lock.current = false;
          }
        }}
      >
        {busy ? "Đang cập nhật…" : `Xác nhận ${label.toLowerCase()}`}
      </button>
    </Modal>
  );
}
