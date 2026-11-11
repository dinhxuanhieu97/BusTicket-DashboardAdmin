"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../modal";
import {
  type TripOptions,
  parseFareThousands,
  createTripInput,
  vnInputToISO,
} from "@/lib/trip-management";
import { vnDateTime, vnd, type Trip } from "@/lib/live-contracts";
import { operation } from "./operations-client";
import type { OperatorProfile } from "./general-information";
import { PN_SCHEDULE } from "@/lib/trip-detail";
import { FareFields } from "./fare-fields";
import {
  Bus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
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

  const [defaultTime, setDefaultTime] = useState<string>(PN_SCHEDULE.depart);
  useEffect(() => {
    let active = true;
    void operation<OperatorProfile>("profile")
      .then((p) => {
        if (!active) return;
        const next = `${date}T${p.defaultDepartureTime}`;
        setDefaultTime(p.defaultDepartureTime);
        setDepart((v) => (v === `${date}T${PN_SCHEDULE.depart}` ? next : v));
        setClose((v) => (v === `${date}T${PN_SCHEDULE.depart}` ? next : v));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [date]);
  const routeInfo = options?.routes.find((r) => r.id === route);
  const defaultName = routeInfo
    ? `Chuyến ${routeInfo.origin} → ${routeInfo.destination}`
    : "";
  const selected = options?.vehicles.find((v) => v.id === vehicle);

  const prepare = (status: "DRAFT" | "OPEN") => {
    setError("");
    try {
      const fares = (selected?.fares ?? []).map((f) => {
        const raw = prices[`${f.floor}:${f.occupancy}`] ?? "";
        const price = parseFareThousands(raw);
        if (price === null)
          throw Error("Nhập đủ giá vé từ 0 đến 20.000 nghìn đồng.");
        return { floor: f.floor, occupancy: f.occupancy, price };
      });
      const data = createTripInput.safeParse({
        routeId: route,
        vehicleId: vehicle,
        name: name.trim() || defaultName,
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
      <div className="space-y-5">
        <p className="text-xs leading-relaxed text-muted">
          Giờ Việt Nam (UTC+7) · Giá vé VND. Dữ liệu sẽ được lưu vào nhà xe của
          bạn.
        </p>

        {loadError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-warning">
            <p role="alert">{loadError} Đóng và mở lại để tải lại.</p>
          </div>
        )}

        {!options && !loadError && (
          <div className="flex items-center gap-2 p-4 text-center text-sm text-muted">
            <div className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Đang tải tuyến và xe…</span>
          </div>
        )}

        {options &&
          (!options.routes.length ||
            !options.vehicles.some((v) => v.usable)) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-warning">
              <p role="alert">
                Chưa có tuyến hoặc xe hoạt động với sơ đồ khả dụng. Cần cấu hình
                tuyến/xe trước khi tạo chuyến.
              </p>
            </div>
          )}

        {options && !review && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              prepare("DRAFT");
            }}
            className="space-y-4"
          >
            <div className="pn-form-grid sm:grid-cols-2">
              <label className="label">
                Tuyến
                <select
                  className="field"
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
                  className="field"
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
            </div>

            <div className="pn-form-grid sm:grid-cols-2">
              <label className="label">
                Tên chuyến
                <input
                  className="field"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={defaultName || "Tự điền theo tuyến"}
                />
              </label>

              <label className="label">
                Số điện thoại liên hệ (tùy chọn)
                <input
                  className="field"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Số điện thoại tài xế / tổng đài"
                />
              </label>
            </div>

            <div className="rounded-xl border border-line/60 bg-surface/30 p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                <span className="font-semibold uppercase tracking-wider">
                  Khung giờ chạy & mở bán
                </span>
                <span className="text-[11px]">
                  Giờ mặc định: {defaultTime} → {PN_SCHEDULE.arrive}
                </span>
              </div>
              <div className="pn-form-grid sm:grid-cols-2">
                {[
                  { label: "Khởi hành", value: depart, set: setDepart },
                  { label: "Mở bán từ", value: open, set: setOpen },
                  { label: "Đóng bán lúc", value: close, set: setClose },
                ].map((f) => (
                  <label
                    className={`label ${f.label === "Khởi hành" ? "max-w-xs sm:col-span-2" : ""}`}
                    key={f.label}
                  >
                    {f.label}
                    <input
                      className="field font-mono text-sm"
                      type="datetime-local"
                      required
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <FareFields
              fares={selected?.fares ?? []}
              valueFor={(key) => prices[key] ?? ""}
              onChange={(key, value) =>
                setPrices((current) => ({ ...current, [key]: value }))
              }
            />

            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                disabled={!selected?.usable || uncertain}
                type="submit"
              >
                Lưu nháp
              </button>
              <button
                className="btn btn-primary"
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
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
              <h3 className="text-base font-bold text-ink">
                Kiểm tra trước khi{" "}
                {review.status === "DRAFT" ? "lưu nháp" : "mở bán"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-accent">
                {review.name}
              </p>
            </div>

            <div className="rounded-xl border border-line/60 bg-surface/30 p-4 space-y-2 text-sm">
              <p className="text-ink">
                <span className="text-muted">Tuyến / xe: </span>
                <span className="font-semibold">
                  {options?.routes.find((r) => r.id === review.routeId)?.code} ·{" "}
                  {selected?.code} · {selected?.name}
                </span>
              </p>
              <p className="font-mono text-xs text-muted">
                Khởi hành:{" "}
                <strong className="text-ink">
                  {vnDateTime(review.departAt)}
                </strong>
              </p>
              <p className="font-mono text-xs text-muted">
                Mở bán:{" "}
                <strong className="text-ink">
                  {vnDateTime(review.salesOpenAt)}
                </strong>
              </p>
              <p className="font-mono text-xs text-muted">
                Đóng bán:{" "}
                <strong className="text-ink">
                  {vnDateTime(review.salesCloseAt)}
                </strong>
              </p>
              <div className="border-t border-line/60 pt-2 space-y-1">
                {review.fares.map((f) => (
                  <p key={`${f.floor}:${f.occupancy}`} className="text-xs">
                    <span className="text-muted">
                      Tầng {f.floor} · {f.occupancy} người:{" "}
                    </span>
                    <strong className="font-mono font-bold text-ink">
                      {vnd(f.price)}
                    </strong>
                  </p>
                ))}
              </div>
            </div>

            {review.status === "OPEN" && (
              <p className="text-xs text-warning">
                Chuyến sẽ nhận đặt vé trong khung giờ bán đã chọn.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                disabled={busy || uncertain}
                onClick={() => setReview(null)}
              >
                Quay lại chỉnh
              </button>
              <button
                className="btn btn-primary"
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
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-warning">
            <p role="alert">{error}</p>
          </div>
        )}
      </div>
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
      <div className="space-y-4">
        <div className="rounded-xl border border-line/60 bg-surface/30 p-4">
          <p className="text-base font-bold text-ink">{trip.name}</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {vnDateTime(trip.depart_at)} · {trip.vehicle_code}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-muted">
          {status === "CLOSED"
            ? "Ngừng nhận đặt vé mới. Các vé đã đặt được giữ nguyên."
            : "Cho phép nhận đặt vé trong thời gian mở/đóng bán của chuyến."}
        </p>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-warning">
            <p role="alert">{error}</p>
          </div>
        )}

        <div className="pt-2">
          <button
            className={`btn w-full ${
              status === "CLOSED"
                ? "hover:border-amber-500 hover:text-warning"
                : "btn-primary"
            }`}
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
        </div>
      </div>
    </Modal>
  );
}
