"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bus,
  BusFront,
  Camera,
  Clock,
  MapPin,
  Phone,
  ScanLine,
  Users,
} from "lucide-react";
import { Modal } from "../modal";
import { boardingTarget, type BoardingResult } from "@/lib/passenger-ops";
import { vnDateTime, vnd } from "@/lib/live-contracts";
import {
  paymentStatusLabels,
  type AssignedTrip,
  type TripPassengers,
} from "@/lib/trip-assistants";
import {
  EmptyState,
  LoadState,
  Notice,
  RefreshButton,
  postJson,
  StatusBadge,
  TableScroll,
  tableClass,
  tdClass,
  thClass,
} from "./shared";

export function useJson<T>(url: string | null) {
  const [state, setState] = useState<{
    url: string | null;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ url, data: null, error: "", loading: !!url });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!url) return;
    const c = new AbortController();
    setState({ url, data: null, error: "", loading: true });
    fetch(url, { cache: "no-store", signal: c.signal })
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 401) return window.location.replace("/login");
        if (body.error?.code === "MFA_SETUP_REQUIRED")
          return window.location.replace("/mfa");
        if (!res.ok)
          throw Error(body.error?.message || "Không tải được dữ liệu.");
        setState({ url, data: body, error: "", loading: false });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState({
            url,
            data: null,
            error: e instanceof Error ? e.message : "Mất kết nối API.",
            loading: false,
          });
      });
    return () => c.abort();
  }, [url, revision]);
  const current = state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: !current || state.loading,
    reload: () => setRevision((n) => n + 1),
  };
}

/**
 * Trang của phụ xe: chỉ các chuyến được giao và danh sách khách của từng chuyến. Có `trip.assigned.board` thì quét vé /
 * gõ mã vé và bấm "Lên xe" cho khách của chuyến đó.
 */
export function AssignedTrips({ canBoard = false }: { canBoard?: boolean }) {
  const list = useJson<{ trips: AssignedTrip[]; fetchedAt: string }>(
    "/api/assigned-trips",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const trips = list.data?.trips ?? [];
  const active = trips.find((t) => t.id === selected) ?? trips[0] ?? null;

  return (
    <div className="pn-page-stack">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="pn-section-label">Chuyến được giao</h2>
          <p className="text-sm text-muted">
            Chỉ hiển thị chuyến điều hành đã giao cho bạn, từ hôm qua trở đi.
          </p>
        </div>
        <RefreshButton reload={list.reload} loading={list.loading} />
      </div>

      {list.error && <LoadState error={list.error} reload={list.reload} />}

      {list.data && trips.length === 0 && (
        <EmptyState icon={Bus}>
          Chưa có chuyến nào được giao cho bạn. Liên hệ điều hành nếu bạn nghĩ
          đây là nhầm lẫn.
        </EmptyState>
      )}

      {trips.length > 0 && (
        <ul
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Chuyến được giao"
        >
          {trips.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={active?.id === t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  active?.id === t.id
                    ? "border-accent bg-accent/10"
                    : "border-line/60 bg-surface/30 hover:bg-surface/50"
                }`}
              >
                <p className="font-semibold text-ink">{t.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <Clock size={13} aria-hidden="true" />
                  {vnDateTime(t.departAt)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin size={13} aria-hidden="true" />
                  {t.route.origin} → {t.route.destination}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <Bus size={13} aria-hidden="true" />
                  {t.vehicle.name}
                  {t.vehicle.plateNumber ? ` · ${t.vehicle.plateNumber}` : ""}
                </p>
                <p className="mt-2 text-xs font-medium text-ink">
                  {t.bookingCount} đơn · {t.seatCount} chỗ đã xác nhận
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && <Passengers trip={active} canBoard={canBoard} />}
    </div>
  );
}

type Message = { tone: "success" | "danger" | "warning"; text: string };

function boardedText(r: BoardingResult) {
  const b = r.booking;
  const seats = b.seats
    .filter((s) => s.boardedAt)
    .map((s) => s.code)
    .join(", ");
  const due = b.dueAmount > 0 ? ` Còn thu ${vnd(b.dueAmount)}.` : "";
  return `${b.code} · ${b.contactName}: ${seats ? `chỗ ${seats} đã lên xe` : "chưa lên xe"}.${due}`;
}

function Passengers({
  trip,
  canBoard,
}: {
  trip: AssignedTrip;
  canBoard: boolean;
}) {
  const { data, error, loading, reload } = useJson<TripPassengers>(
    `/api/assigned-trips/${encodeURIComponent(trip.id)}/passengers`,
  );
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const url = `/api/assigned-trips/${encodeURIComponent(trip.id)}/boarding`;

  async function board(body: object, key: string) {
    setBusy(key);
    setMessage(null);
    try {
      const r = await postJson<BoardingResult>(url, body);
      setMessage({
        tone: r.booking.dueAmount > 0 ? "warning" : "success",
        text: boardedText(r),
      });
      reload();
      return true;
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      aria-labelledby="passenger-heading"
      className="rounded-xl border border-line/60 bg-surface/20 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="passenger-heading" className="text-base font-semibold">
            Danh sách khách · {trip.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {data
              ? `Cập nhật: ${vnDateTime(data.fetchedAt)} · chỉ đơn đã xác nhận`
              : "Đang đọc dữ liệu mới nhất…"}
          </p>
        </div>
        <RefreshButton reload={reload} loading={loading} />
      </div>
      {canBoard && (
        <ScanForm
          busy={busy === "scan"}
          onSubmit={(target) => board(target, "scan")}
          onInvalid={(text) => setMessage({ tone: "danger", text })}
        />
      )}
      {message && (
        <div className="mb-3" data-message>
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {error && <LoadState error={error} reload={reload} />}
      {data && (
        <>
          <ul
            className="mb-3 flex flex-wrap gap-2 text-xs"
            aria-label="Tóm tắt"
          >
            {data.summary.boarded !== undefined && (
              <li>
                <StatusBadge
                  tone={
                    data.summary.boarded === data.summary.seats
                      ? "success"
                      : "neutral"
                  }
                  icon={BusFront}
                  label={`Đã lên xe: ${data.summary.boarded}/${data.summary.seats} chỗ`}
                />
              </li>
            )}
            <li>
              <StatusBadge
                tone="info"
                icon={Users}
                label={`${data.summary.people} khách · ${data.summary.seats} chỗ`}
              />
            </li>
            {data.summary.infants > 0 && (
              <li>
                <StatusBadge
                  tone="neutral"
                  label={`${data.summary.infants} em bé`}
                />
              </li>
            )}
            <li>
              <StatusBadge
                tone={data.summary.dueAmount > 0 ? "warning" : "success"}
                label={`Còn thu: ${vnd(data.summary.dueAmount)}`}
              />
            </li>
            {data.trip.contactPhone && (
              <li>
                <StatusBadge
                  tone="neutral"
                  icon={Phone}
                  label={`Liên hệ chuyến: ${data.trip.contactPhone}`}
                />
              </li>
            )}
          </ul>
          {data.bookings.length === 0 ? (
            <p className="text-sm text-muted">
              Chuyến chưa có khách đã xác nhận.
            </p>
          ) : (
            <TableScroll label="Danh sách khách">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Chỗ</th>
                    <th className={thClass}>Khách</th>
                    <th className={thClass}>Điện thoại</th>
                    <th className={thClass}>Mã đơn</th>
                    <th className={thClass}>Lên xe</th>
                    <th className={thClass}>Thanh toán</th>
                    <th className={`${thClass} text-right`}>Còn thu</th>
                    <th className={thClass}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr key={b.code} data-booking={b.code}>
                      <td className={`${tdClass} font-mono`}>
                        {b.seats
                          .map(
                            (s) =>
                              s.code +
                              (s.occupancy > 1 ? ` (${s.occupancy})` : "") +
                              (s.infantCount ? ` +${s.infantCount} bé` : ""),
                          )
                          .join(", ")}
                      </td>
                      <td className={`${tdClass} font-medium text-ink`}>
                        {b.contactName}
                      </td>
                      <td className={tdClass}>
                        <a
                          href={`tel:${b.contactPhone}`}
                          className="text-accent underline-offset-2 hover:underline"
                        >
                          {b.contactPhone}
                        </a>
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {b.code}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <BoardButton
                          code={b.code}
                          done={b.seats.filter((x) => x.boardedAt).length}
                          total={b.seats.length}
                          canBoard={canBoard}
                          busy={busy === b.code}
                          onToggle={(boarded) =>
                            void board({ bookingCode: b.code, boarded }, b.code)
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        {paymentStatusLabels[b.paymentStatus] ??
                          b.paymentStatus}
                      </td>
                      <td
                        className={`${tdClass} text-right font-mono ${b.dueAmount > 0 ? "font-bold text-warning" : "text-muted"}`}
                      >
                        {vnd(b.dueAmount)}
                      </td>
                      <td className={`${tdClass} max-w-64 break-words`}>
                        {b.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </>
      )}
    </section>
  );
}

function BoardButton({
  code,
  done,
  total,
  canBoard,
  busy,
  onToggle,
}: {
  code: string;
  done: number;
  total: number;
  canBoard: boolean;
  busy: boolean;
  onToggle: (boarded: boolean) => void;
}) {
  const all = done === total;
  const label = `${done}/${total} lên xe`;
  if (!canBoard)
    return <StatusBadge tone={all ? "success" : "neutral"} label={label} />;
  return (
    <button
      type="button"
      className={`btn px-3 text-xs ${all ? "btn-primary" : ""}`}
      aria-pressed={all}
      aria-label={
        all
          ? `Bỏ đánh dấu lên xe đơn ${code}`
          : `Đánh dấu đơn ${code} đã lên xe`
      }
      disabled={busy}
      onClick={() => onToggle(!all)}
    >
      <BusFront size={14} aria-hidden="true" />
      {busy ? "Đang lưu…" : label}
    </button>
  );
}

type Detector = {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type DetectorCtor = new (opts: { formats: string[] }) => Detector;
const detectorCtor = () =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

/**
 * Ô quét vé: gõ mã vé, dán nội dung QR, hoặc dùng máy quét mã vạch (gõ phím + Enter). Nút camera chỉ hiện khi trình
 * duyệt có `BarcodeDetector` (Chrome Android); Safari iOS dùng ô nhập.
 */
function ScanForm({
  busy,
  onSubmit,
  onInvalid,
}: {
  busy: boolean;
  onSubmit: (target: object) => Promise<boolean>;
  onInvalid: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => setHasCamera(!!detectorCtor()), []);

  async function send(raw: string) {
    const target = boardingTarget(raw);
    if (!target) {
      onInvalid(
        "Mã không hợp lệ. Nhập mã vé (ví dụ PNAB12CD) hoặc quét QR trên vé.",
      );
      return;
    }
    if (await onSubmit(target)) setValue("");
  }

  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send(value);
      }}
    >
      <div className="min-w-48 flex-1">
        <label htmlFor="scan-input" className="label mb-1.5">
          Quét vé hoặc nhập mã vé
        </label>
        <input
          id="scan-input"
          className="field w-full font-mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || !value.trim()}
      >
        <ScanLine size={15} aria-hidden="true" />
        {busy ? "Đang lưu…" : "Lên xe"}
      </button>
      {hasCamera && (
        <button type="button" className="btn" onClick={() => setCamera(true)}>
          <Camera size={15} aria-hidden="true" />
          Quét bằng camera
        </button>
      )}
      {camera && (
        <CameraScanner
          onClose={() => setCamera(false)}
          onDetected={(raw) => {
            setCamera(false);
            setValue(raw);
            void send(raw);
          }}
        />
      )}
    </form>
  );
}

function CameraScanner({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (raw: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const detected = useRef(onDetected);
  detected.current = onDetected;
  const [error, setError] = useState("");
  useEffect(() => {
    const Ctor = detectorCtor();
    if (!Ctor) return;
    const detector = new Ctor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current)
          return s.getTracks().forEach((t) => t.stop());
        video.current.srcObject = s;
        await video.current.play();
        timer = setInterval(async () => {
          if (!video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) {
            clearInterval(timer);
            detected.current(found[0].rawValue);
          }
        }, 300);
      })
      .catch(() =>
        setError("Không mở được camera. Cho phép camera hoặc nhập mã vé."),
      );
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <Modal title="Quét QR trên vé" onClose={onClose}>
      {error ? (
        <Notice tone="danger">{error}</Notice>
      ) : (
        <video
          ref={video}
          className="aspect-square w-full rounded-xl bg-black object-cover"
          muted
          playsInline
          aria-label="Khung camera quét vé"
        />
      )}
    </Modal>
  );
}
