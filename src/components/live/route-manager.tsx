"use client";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "../modal";
import { routesSchema } from "@/lib/trip-management";
import { listPlaces, type PlaceUsage } from "@/lib/routes";
import { operation } from "./operations-client";
import { RouteStopsEditor } from "./route-stops-editor";
import {
  EmptyRow,
  LoadState,
  Notice,
  RefreshButton,
  TableScroll,
  tdClass,
  thClass,
} from "./shared";

type RouteRow = ReturnType<typeof routesSchema.parse>["routes"][number];
type Action =
  | { kind: "pair" }
  | { kind: "rename"; place: PlaceUsage }
  | { kind: "stops"; route: RouteRow }
  | { kind: "delete"; route: RouteRow };

/**
 * Tuyến đường: điểm đi/đến (đổi tên trên mọi tuyến), thêm cặp tuyến hai chiều, điểm đón/trả từng chiều,
 * xóa tuyến tạo nhầm. API kiểm tra quyền `route.write` và chặn xóa tuyến đã có chuyến/lịch chạy.
 */
export function RouteManager({ canWrite }: { canWrite: boolean }) {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRoutes(routesSchema.parse(await operation("routes")).routes);
    } catch (e) {
      setError((e as Error).message || "Không tải được danh sách tuyến.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const places = useMemo(() => listPlaces(routes ?? []), [routes]);
  const open = (a: Action) => {
    setMessage("");
    setAction(a);
  };
  const done = (text: string) => {
    setAction(null);
    setMessage(text);
    void load();
  };

  return (
    <div className="pn-page-stack">
      <div className="pn-page-hero">
        <h2 className="pn-page-hero-title">Tuyến đường</h2>
        <div className="flex flex-wrap gap-2">
          <RefreshButton reload={() => void load()} loading={loading} />
          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !routes}
              onClick={() => open({ kind: "pair" })}
            >
              <Plus size={16} aria-hidden="true" />
              Thêm cặp tuyến
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">
        Điểm đi/điểm đến là tên hiển thị trên Mini App. Đổi tên một điểm áp dụng
        cho mọi tuyến (cả chiều đi và về); tên chuyến đã sinh từ lịch chạy giữ
        tên cũ. Tuyến đã có chuyến hoặc lịch chạy không xóa được.
      </p>
      {message && <Notice tone="success">{message}</Notice>}
      <LoadState
        loading={loading && !routes}
        error={error}
        reload={() => void load()}
      />

      {routes && (
        <section className="card overflow-hidden" aria-busy={loading}>
          <header className="pn-table-header">
            <h3 className="font-bold text-ink">
              {places.length} điểm đi/điểm đến
            </h3>
          </header>
          <TableScroll label="Danh sách điểm đi và điểm đến">
            <table
              aria-label="Điểm đi và điểm đến"
              className="pn-table w-full min-w-[560px] border-collapse text-left text-sm"
            >
              <thead>
                <tr>
                  {[
                    "Tên điểm",
                    "Là điểm đi",
                    "Là điểm đến",
                    ...(canWrite ? ["Thao tác"] : []),
                  ].map((label) => (
                    <th scope="col" className={thClass} key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {places.length === 0 && (
                  <EmptyRow
                    columns={canWrite ? 4 : 3}
                    text="Chưa có tuyến nào."
                  />
                )}
                {places.map((p) => (
                  <tr key={p.name} data-place={p.name}>
                    <td className={`${tdClass} font-semibold`}>{p.name}</td>
                    <td className={tdClass}>{p.asOrigin} tuyến</td>
                    <td className={tdClass}>{p.asDestination} tuyến</td>
                    {canWrite && (
                      <td className={tdClass}>
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Đổi tên điểm ${p.name}`}
                          onClick={() => open({ kind: "rename", place: p })}
                        >
                          Đổi tên
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}

      {routes && (
        <section className="card overflow-hidden" aria-busy={loading}>
          <header className="pn-table-header">
            <h3 className="font-bold text-ink">{routes.length} tuyến</h3>
          </header>
          <TableScroll label="Danh sách tuyến">
            <table
              aria-label="Tuyến"
              className="pn-table w-full min-w-[720px] border-collapse text-left text-sm"
            >
              <thead>
                <tr>
                  {[
                    "Mã tuyến",
                    "Điểm đi",
                    "Điểm đến",
                    "Điểm đón",
                    "Điểm trả",
                    "Thao tác",
                  ].map((label) => (
                    <th scope="col" className={thClass} key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 && (
                  <EmptyRow columns={6} text="Chưa có tuyến nào." />
                )}
                {routes.map((r) => (
                  <tr key={r.id} data-route={r.code}>
                    <td className={`${tdClass} font-mono font-semibold`}>
                      {r.code}
                    </td>
                    <td className={tdClass}>{r.origin}</td>
                    <td className={tdClass}>{r.destination}</td>
                    <td className={tdClass}>
                      {r.stops?.pickup.length ?? 0} điểm
                    </td>
                    <td className={tdClass}>
                      {r.stops?.dropoff.length ?? 0} điểm
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Điểm đón/trả tuyến ${r.code}`}
                          onClick={() => open({ kind: "stops", route: r })}
                        >
                          {canWrite ? "Điểm đón/trả" : "Xem điểm"}
                        </button>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn pn-tone"
                            data-tone="danger"
                            aria-label={`Xóa tuyến ${r.code}`}
                            onClick={() => open({ kind: "delete", route: r })}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}

      {action?.kind === "pair" && (
        <PairForm
          places={places.map((p) => p.name)}
          onClose={() => setAction(null)}
          onSaved={(code) => done(`Đã thêm cặp tuyến ${code}.`)}
        />
      )}
      {action?.kind === "rename" && (
        <RenamePlace
          place={action.place}
          others={places.map((p) => p.name)}
          onClose={() => setAction(null)}
          onSaved={(to) => done(`Đã đổi "${action.place.name}" thành "${to}".`)}
        />
      )}
      {action?.kind === "stops" && (
        <StopsDialog
          route={action.route}
          canWrite={canWrite}
          onClose={() => setAction(null)}
          onSaved={() =>
            done(`Đã lưu điểm đón/trả tuyến ${action.route.code}.`)
          }
        />
      )}
      {action?.kind === "delete" && (
        <DeleteRoute
          route={action.route}
          onClose={() => setAction(null)}
          onDeleted={() => done(`Đã xóa tuyến ${action.route.code}.`)}
        />
      )}
    </div>
  );
}

/** Gửi một thao tác và giữ trạng thái bận/lỗi cho hộp thoại. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      after();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function Actions({
  busy,
  onClose,
  label,
  busyLabel,
  danger = false,
  onClick,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
  busyLabel: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" className="btn" disabled={busy} onClick={onClose}>
        Hủy
      </button>
      <button
        type={onClick ? "button" : "submit"}
        className={danger ? "btn pn-tone" : "btn btn-primary"}
        data-tone={danger ? "danger" : undefined}
        disabled={busy}
        onClick={onClick}
      >
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

function PairForm({
  places,
  onClose,
  onSaved,
}: {
  places: string[];
  onClose: () => void;
  onSaved: (code: string) => void;
}) {
  const listId = useId();
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    code: "",
    reverseCode: "",
  });
  const { busy, error, setError, run } = useSubmit();
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title="Thêm cặp tuyến" onClose={onClose}>
      <form
        className="pn-page-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const data = {
            origin: form.origin.trim(),
            destination: form.destination.trim(),
            code: form.code.trim(),
            reverseCode: form.reverseCode.trim(),
          };
          if (!data.origin || !data.destination)
            return setError("Nhập điểm đi và điểm đến.");
          if (data.origin === data.destination)
            return setError("Điểm đi và điểm đến phải khác nhau.");
          const code = /^[A-Z0-9-]{2,32}$/;
          if (!code.test(data.code) || !code.test(data.reverseCode))
            return setError(
              "Mã tuyến gồm 2–32 ký tự: chữ in hoa, số hoặc dấu gạch ngang.",
            );
          if (data.code === data.reverseCode)
            return setError("Mã chiều đi và chiều về phải khác nhau.");
          void run(
            () => operation("route-pairs", "POST", data),
            () => onSaved(`${data.code}/${data.reverseCode}`),
          );
        }}
      >
        {error && <Notice tone="danger">{error}</Notice>}
        <datalist id={listId}>
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div className="pn-form-grid sm:grid-cols-2">
          <label className="label">
            Điểm đi
            <input
              className="field"
              list={listId}
              maxLength={80}
              value={form.origin}
              onChange={(e) => set("origin", e.target.value)}
            />
          </label>
          <label className="label">
            Điểm đến
            <input
              className="field"
              list={listId}
              maxLength={80}
              value={form.destination}
              onChange={(e) => set("destination", e.target.value)}
            />
          </label>
          <label className="label">
            Mã chiều đi
            <input
              className="field font-mono"
              maxLength={32}
              placeholder="SG-DL"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </label>
          <label className="label">
            Mã chiều về
            <input
              className="field font-mono"
              maxLength={32}
              placeholder="DL-SG"
              value={form.reverseCode}
              onChange={(e) => set("reverseCode", e.target.value.toUpperCase())}
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          Tạo cả chiều đi và chiều về. Mã đã có với cùng điểm đi/đến được giữ
          nguyên. Thêm điểm đón/trả cho từng chiều sau khi tạo.
        </p>
        <Actions
          busy={busy}
          onClose={onClose}
          label="Thêm cặp tuyến"
          busyLabel="Đang lưu…"
        />
      </form>
    </Modal>
  );
}

function RenamePlace({
  place,
  others,
  onClose,
  onSaved,
}: {
  place: PlaceUsage;
  others: string[];
  onClose: () => void;
  onSaved: (to: string) => void;
}) {
  const [to, setTo] = useState(place.name);
  const { busy, error, setError, run } = useSubmit();
  const total = place.asOrigin + place.asDestination;
  const key = (v: string) =>
    v.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
  const merging = others.find(
    (p) => key(p) === key(to) && key(to) !== key(place.name),
  );
  return (
    <Modal title={`Đổi tên điểm ${place.name}`} onClose={onClose}>
      <form
        className="pn-page-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const name = to.normalize("NFC").trim().replace(/\s+/g, " ");
          if (!name) return setError("Nhập tên điểm.");
          if (name === place.name) return onClose();
          void run(
            () => operation("places", "PUT", { from: place.name, to: name }),
            () => onSaved(name),
          );
        }}
      >
        {error && <Notice tone="danger">{error}</Notice>}
        <label className="label">
          Tên mới
          <input
            className="field"
            maxLength={80}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <p className="text-sm text-muted">
          Áp dụng cho {total} lượt dùng trên các tuyến (điểm đi và điểm đến).
          Tên chuyến đã sinh từ lịch chạy và liên kết cũ trên Mini App giữ tên
          cũ.
        </p>
        {merging && (
          <Notice tone="warning">
            &quot;{merging}&quot; đã có. Lưu sẽ gộp hai điểm thành một; nếu hai
            tuyến trùng điểm đi và điểm đến, Mini App hiện cả hai.
          </Notice>
        )}
        <Actions
          busy={busy}
          onClose={onClose}
          label="Lưu tên"
          busyLabel="Đang lưu…"
        />
      </form>
    </Modal>
  );
}

function StopsDialog({
  route,
  canWrite,
  onClose,
  onSaved,
}: {
  route: RouteRow;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { busy, error, run } = useSubmit();
  const stops = route.stops ?? { pickup: [], dropoff: [] };
  return (
    <Modal
      title={`Điểm đón/trả ${route.code} · ${route.origin} → ${route.destination}`}
      onClose={onClose}
    >
      {error && <Notice tone="danger">{error}</Notice>}
      {canWrite ? (
        <RouteStopsEditor
          initial={stops}
          busy={busy}
          onSave={(next) =>
            void run(
              () => operation(`routes/${route.id}/stops`, "PUT", next),
              onSaved,
            )
          }
        />
      ) : (
        <div className="space-y-4 py-2 text-sm">
          {(["pickup", "dropoff"] as const).map((kind) => (
            <div key={kind}>
              <h4 className="font-semibold">
                {kind === "pickup" ? "Điểm đón" : "Điểm trả"}
              </h4>
              {stops[kind].length ? (
                <ul>
                  {stops[kind].map((s, i) => (
                    <li key={`${i}-${s.name}`}>
                      {s.time}
                      {s.day > 0 ? ` (+${s.day} ngày)` : ""} · {s.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Chưa có.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function DeleteRoute({
  route,
  onClose,
  onDeleted,
}: {
  route: RouteRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { busy, error, run } = useSubmit();
  return (
    <Modal title={`Xóa tuyến ${route.code}`} onClose={onClose}>
      <div className="pn-page-stack">
        <p className="text-sm">
          Xóa hẳn tuyến <strong>{route.code}</strong> ({route.origin} →{" "}
          {route.destination}) cùng điểm đón/trả của tuyến. Chiều ngược lại
          không bị xóa. Chỉ xóa được tuyến chưa có chuyến hoặc lịch chạy.
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
        <Actions
          busy={busy}
          onClose={onClose}
          label="Xóa tuyến"
          busyLabel="Đang xóa…"
          danger
          onClick={() =>
            void run(
              // BFF chỉ nhận mutation dạng JSON (chống CSRF); body rỗng không chuyển tiếp.
              () => operation(`routes/${route.id}`, "DELETE", {}),
              onDeleted,
            )
          }
        />
      </div>
    </Modal>
  );
}
