"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "../modal";
import {
  fleetLayoutsSchema,
  fleetVehiclesSchema,
  LAYOUT_KIND,
  nextVehicleCode,
  vehicleCodePattern,
  vehicleStatusLabels,
  vehicleTypeLabels,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type FleetLayout,
  type FleetVehicle,
  type VehicleStatus,
  type VehicleType,
} from "@/lib/fleet";
import { operation } from "./operations-client";
import {
  EmptyRow,
  LoadState,
  Notice,
  RefreshButton,
  StatusBadge,
  TableScroll,
  tdClass,
  thClass,
} from "./shared";

type Data = {
  prefix: string;
  vehicles: FleetVehicle[];
  layouts: FleetLayout[];
};
type Action =
  | { kind: "create" }
  | { kind: "edit"; vehicle: FleetVehicle }
  | { kind: "delete"; vehicle: FleetVehicle };

const statusTone = {
  ACTIVE: "success",
  MAINTENANCE: "warning",
  RETIRED: "neutral",
} as const;

/**
 * Đội xe: thêm xe (mã, tên, loại, sơ đồ, biển số), sửa tên/biển số/sơ đồ/trạng thái, xóa xe nhập nhầm.
 * Chỉ xe "Đang chạy" xuất hiện khi tạo chuyến. API kiểm tra quyền, mã xe, loại sơ đồ và chặn xóa xe đã có chuyến.
 */
export function VehicleManager({ canWrite }: { canWrite: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, v, l] = await Promise.all([
        operation<{ code: string }>("profile"),
        operation<unknown>("vehicles"),
        operation<unknown>("seat-layouts"),
      ]);
      setData({
        prefix: profile.code,
        vehicles: fleetVehiclesSchema.parse(v).vehicles,
        layouts: fleetLayoutsSchema.parse(l).layouts,
      });
    } catch (e) {
      setError((e as Error).message || "Không tải được danh sách xe.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const done = (text: string) => {
    setAction(null);
    setMessage(text);
    void load();
  };
  const layoutName = (id: string) =>
    data?.layouts.find((l) => l.id === id)?.name ?? "Sơ đồ phiên bản cũ";

  return (
    <div className="pn-page-stack">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="pn-section-label">Đội xe</h2>
        <div className="flex flex-wrap gap-2">
          <RefreshButton reload={() => void load()} loading={loading} />
          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !data}
              onClick={() => {
                setMessage("");
                setAction({ kind: "create" });
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Thêm xe
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">
        Chỉ xe <strong>Đang chạy</strong> được chọn khi tạo chuyến. Xe đã có
        chuyến không xóa được; chuyển sang <strong>Ngừng chạy</strong> để ẩn.
        Đổi sơ đồ chỉ áp dụng cho chuyến tạo sau.
      </p>
      {message && <Notice tone="success">{message}</Notice>}
      <LoadState
        loading={loading && !data}
        error={error}
        reload={() => void load()}
      />

      {data && (
        <section className="card overflow-hidden" aria-busy={loading}>
          <header className="pn-table-header">
            <h3 className="font-bold text-ink">{data.vehicles.length} xe</h3>
          </header>
          <TableScroll label="Danh sách xe">
            <table
              aria-label="Đội xe"
              className="pn-table w-full min-w-[720px] border-collapse text-left text-sm"
            >
              <thead>
                <tr>
                  {[
                    "Mã xe",
                    "Tên xe",
                    "Loại",
                    "Biển số",
                    "Sơ đồ chỗ",
                    "Trạng thái",
                    ...(canWrite ? ["Thao tác"] : []),
                  ].map((label) => (
                    <th scope="col" className={thClass} key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.vehicles.length === 0 && (
                  <EmptyRow columns={canWrite ? 7 : 6} text="Chưa có xe." />
                )}
                {data.vehicles.map((v) => (
                  <tr key={v.id} data-vehicle={v.code}>
                    <td className={`${tdClass} font-mono font-semibold`}>
                      {v.code}
                    </td>
                    <td className={tdClass}>{v.name}</td>
                    <td className={tdClass}>{vehicleTypeLabels[v.type]}</td>
                    <td className={`${tdClass} font-mono`}>
                      {v.plate_number ?? (
                        <span className="text-muted">Chưa có</span>
                      )}
                    </td>
                    <td className={tdClass}>{layoutName(v.seat_layout_id)}</td>
                    <td className={tdClass}>
                      <StatusBadge
                        tone={statusTone[v.status]}
                        label={vehicleStatusLabels[v.status]}
                      />
                    </td>
                    {canWrite && (
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn"
                            aria-label={`Sửa xe ${v.code}`}
                            onClick={() => {
                              setMessage("");
                              setAction({ kind: "edit", vehicle: v });
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="btn pn-tone"
                            data-tone="danger"
                            aria-label={`Xóa xe ${v.code}`}
                            onClick={() => {
                              setMessage("");
                              setAction({ kind: "delete", vehicle: v });
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}

      {data && action?.kind === "create" && (
        <VehicleForm
          data={data}
          onClose={() => setAction(null)}
          onSaved={(code) => done(`Đã thêm xe ${code}.`)}
        />
      )}
      {data && action?.kind === "edit" && (
        <VehicleForm
          data={data}
          vehicle={action.vehicle}
          onClose={() => setAction(null)}
          onSaved={(code) => done(`Đã lưu xe ${code}.`)}
        />
      )}
      {action?.kind === "delete" && (
        <DeleteVehicle
          vehicle={action.vehicle}
          onClose={() => setAction(null)}
          onDeleted={() => done(`Đã xóa xe ${action.vehicle.code}.`)}
        />
      )}
    </div>
  );
}

function VehicleForm({
  data,
  vehicle,
  onClose,
  onSaved,
}: {
  data: Data;
  vehicle?: FleetVehicle;
  onClose: () => void;
  onSaved: (code: string) => void;
}) {
  const editing = !!vehicle;
  const [form, setForm] = useState({
    code: vehicle?.code ?? nextVehicleCode(data.prefix, data.vehicles),
    name: vehicle?.name ?? "",
    type: (vehicle?.type ?? "LIMOUSINE") as VehicleType,
    plateNumber: vehicle?.plate_number ?? "",
    seatLayoutId: vehicle?.seat_layout_id ?? "",
    status: (vehicle?.status ?? "ACTIVE") as VehicleStatus,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const layouts = data.layouts.filter((l) => l.kind === LAYOUT_KIND[form.type]);
  // Xe đang gắn một phiên bản sơ đồ cũ (không còn trong danh sách): vẫn hiện để không đổi ngoài ý muốn.
  // Tính theo sơ đồ ban đầu của xe để lựa chọn này không biến mất khi người dùng thử chọn sơ đồ khác.
  const originalLayout = vehicle?.seat_layout_id ?? "";
  const currentMissing =
    !!originalLayout && !data.layouts.some((l) => l.id === originalLayout);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = form.name.trim();
    if (!name) return setError("Nhập tên xe.");
    if (!editing && !vehicleCodePattern(data.prefix).test(form.code))
      return setError(
        `Mã xe phải là ${data.prefix} + 2–3 chữ số, ví dụ ${data.prefix}03.`,
      );
    if (!form.seatLayoutId) return setError("Chọn sơ đồ chỗ.");
    setBusy(true);
    try {
      if (editing) {
        const patch: Record<string, unknown> = {};
        if (name !== vehicle.name) patch.name = name;
        const plate = form.plateNumber.trim();
        if (plate !== (vehicle.plate_number ?? ""))
          patch.plateNumber = plate || null;
        if (form.status !== vehicle.status) patch.status = form.status;
        if (form.seatLayoutId !== vehicle.seat_layout_id)
          patch.seatLayoutId = form.seatLayoutId;
        if (Object.keys(patch).length === 0) return onClose();
        await operation(`vehicles/${vehicle.id}`, "PATCH", patch);
        onSaved(vehicle.code);
      } else {
        await operation("vehicles", "POST", {
          code: form.code,
          name,
          type: form.type,
          seatLayoutId: form.seatLayoutId,
          ...(form.plateNumber.trim()
            ? { plateNumber: form.plateNumber.trim() }
            : {}),
        });
        onSaved(form.code);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Sửa xe ${vehicle.code}` : "Thêm xe"}
      onClose={onClose}
    >
      <form className="pn-page-stack" onSubmit={submit} noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="pn-form-grid sm:grid-cols-2">
          <label className="label">
            Mã xe
            <input
              className="field font-mono"
              value={form.code}
              disabled={editing}
              maxLength={7}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </label>
          <label className="label">
            Tên xe
            <input
              className="field"
              value={form.name}
              maxLength={60}
              placeholder="Ví dụ: Xe PN03"
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="label">
            Loại xe
            <select
              className="field"
              value={form.type}
              disabled={editing}
              onChange={(e) => {
                set("type", e.target.value as VehicleType);
                set("seatLayoutId", "");
              }}
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {vehicleTypeLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Biển số (tùy chọn)
            <input
              className="field font-mono"
              value={form.plateNumber}
              maxLength={20}
              placeholder="51B-123.45"
              onChange={(e) => set("plateNumber", e.target.value)}
            />
          </label>
          <label className="label">
            Sơ đồ chỗ
            <select
              className="field"
              value={form.seatLayoutId}
              onChange={(e) => set("seatLayoutId", e.target.value)}
            >
              <option value="">Chọn sơ đồ</option>
              {currentMissing && (
                <option value={originalLayout}>
                  Sơ đồ đang dùng (phiên bản cũ)
                </option>
              )}
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.shared ? " (mẫu chung)" : ""}
                  {l.capacity ? ` · ${l.capacity} chỗ` : ""}
                </option>
              ))}
            </select>
          </label>
          {editing && (
            <label className="label">
              Trạng thái
              <select
                className="field"
                value={form.status}
                onChange={(e) => set("status", e.target.value as VehicleStatus)}
              >
                {VEHICLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {vehicleStatusLabels[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {editing && (
          <p className="text-xs text-muted">
            Không đổi được mã và loại xe vì chuyến cũ đã dùng. Cần loại khác,
            hãy thêm xe mới.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm xe"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteVehicle({
  vehicle,
  onClose,
  onDeleted,
}: {
  vehicle: FleetVehicle;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={`Xóa xe ${vehicle.code}`} onClose={onClose}>
      <div className="pn-page-stack">
        <p className="text-sm">
          Xóa hẳn xe <strong>{vehicle.name}</strong> ({vehicle.code}). Chỉ xóa
          được xe chưa từng có chuyến hay lịch chạy; xe đã chạy hãy chuyển sang
          &quot;Ngừng chạy&quot;.
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn pn-tone"
            data-tone="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                // BFF chỉ nhận mutation dạng JSON (chống CSRF); body rỗng không chuyển tiếp.
                await operation(`vehicles/${vehicle.id}`, "DELETE", {});
                onDeleted();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Đang xóa…" : "Xóa xe"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
