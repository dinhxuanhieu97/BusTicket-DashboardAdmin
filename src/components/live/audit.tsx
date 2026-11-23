"use client";
import { useMemo, useState } from "react";
import { AuditEntry, vnDateTime, vnToday } from "@/lib/live-contracts";
import { addDays } from "@/lib/overview";
import {
  auditActor,
  auditGroup,
  auditGroups,
  filterAudit,
  type AuditGroup,
} from "@/lib/audit-filter";
import { Modal } from "../modal";
import { useResource } from "./use-resource";
import { LoadState, RefreshButton } from "./shared";
import { PageHero } from "../ui/page-hero";
import { FilterTabs } from "../ui/filter-tabs";
import { DateRangePicker, type DateRangePreset } from "../ui/date-range-picker";
import {
  DataTable,
  TableFooter,
  useTableState,
  type Column,
} from "./data-table";
import {
  Bus,
  Clock,
  Code2,
  FileText,
  Route,
  User,
  Wallet,
  X,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

function actionIcon(action: string): LucideIcon {
  if (action.startsWith("vehicle.")) return Warehouse;
  if (action.startsWith("route.")) return Route;
  const group = auditGroup(action);
  if (group === "trip") return Bus;
  if (group === "payment") return Wallet;
  if (group === "user") return User;
  return FileText;
}

const labels: Record<string, string> = {
  "user.create": "Tạo nhân viên",
  "user.update": "Cập nhật nhân viên",
  "user.mfa_enable": "Bật 2FA",
  "user.password_change": "Đổi mật khẩu",
  "operator.create": "Tạo nhà xe",
  "policy.update": "Cập nhật chính sách",
  "vehicle.create": "Tạo xe",
  "vehicle.update": "Cập nhật xe",
  "route.create": "Tạo tuyến",
  "route.stops.update": "Cập nhật điểm đón/trả",
  "trip.create": "Tạo chuyến",
  "trip.status": "Cập nhật trạng thái chuyến",
  "payment.reconcile": "Đối soát thanh toán",
  "payment.manual": "Ghi nhận tiền thủ công",
  "payment.allocate": "Phân bổ tiền",
  "payment.resolve": "Xử lý khoản cần kiểm tra",
  // T5b: mọi mã backend đang ghi (rà `apps/api/src` ngày 22/11).
  "booking.create_staff": "Bán vé tại quầy",
  "booking.edit_staff": "Sửa đơn vé",
  "booking.cancel_staff": "Hủy đơn vé",
  "booking.reinstate": "Khôi phục đơn vé",
  "booking.import": "Nhập danh sách khách",
  "booking.board": "Xác nhận khách lên xe",
  "booking.unboard": "Bỏ xác nhận lên xe",
  "booking.board_import": "Nhập danh sách lên xe",
  "passenger.list.view": "Xem danh sách khách",
  "passenger.list.export": "Xuất danh sách khách",
  "schedule.create": "Tạo lịch tự động",
  "schedule.generate": "Tạo chuyến từ lịch",
  "schedule.exception": "Thêm ngày ngoại lệ cho lịch",
  "schedule.pause": "Tạm dừng lịch",
  "schedule.enable": "Bật lại lịch",
  "trip.assistant.assign": "Phân công phụ xe",
  "trip.assistant.unassign": "Bỏ phân công phụ xe",
  "payment.record_manual": "Ghi nhận tiền thủ công",
  "payment_account.configure": "Cấu hình tài khoản nhận tiền",
  "refund.resolve": "Xử lý khoản hoàn tiền",
  "user.archive": "Xóa nhân viên",
  "user.password_reset": "Đặt lại mật khẩu nhân viên",
  "user.mfa_disable": "Tắt 2FA",
  "owner.password_reset": "Đặt mật khẩu tạm cho chủ xe",
  "vehicle.delete": "Xóa xe",
  "route.delete": "Xóa tuyến",
  "route.pair.create": "Tạo tuyến đi và về",
  "route.place.rename": "Đổi tên điểm",
  "operator.logo.update": "Đổi logo nhà xe",
  "operator.logo.delete": "Xóa logo nhà xe",
};

function getActionColor(action: string) {
  if (action.startsWith("trip."))
    return "border-indigo-500/30 bg-indigo-500/10 text-indigo-400";
  if (action.startsWith("payment."))
    return "border-emerald-500/30 bg-emerald-500/10 text-success";
  if (action.startsWith("user."))
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
  if (action.startsWith("vehicle.") || action.startsWith("route."))
    return "border-amber-500/30 bg-amber-500/10 text-warning";
  return "border-line bg-surface text-muted";
}

const actionLabel = (action: string) => labels[action] || action;

const auditColumns: Column<AuditEntry>[] = [
  {
    key: "at",
    header: "Thời gian",
    render: (e) => (
      <span className="font-mono text-xs whitespace-nowrap text-muted">
        {vnDateTime(e.at)}
      </span>
    ),
    sortValue: (e) => e.at,
  },
  {
    key: "action",
    header: "Thao tác",
    render: (e) => {
      const Icon = actionIcon(e.action);
      return (
        <span className="inline-flex items-center gap-2 font-medium text-ink">
          <span className="pn-list-icon size-7" aria-hidden="true">
            <Icon size={14} />
          </span>
          {actionLabel(e.action)}
        </span>
      );
    },
    sortValue: (e) => actionLabel(e.action),
    className: "whitespace-nowrap",
  },
  {
    key: "actor",
    header: "Người thực hiện",
    render: (e) => auditActor(e),
    sortValue: (e) => auditActor(e),
    className: "whitespace-nowrap",
  },
  {
    key: "entity",
    header: "Đối tượng",
    render: (e) => (
      <span className="font-mono text-xs text-muted">{e.entity}</span>
    ),
  },
];

export function Audit() {
  const { data, error, loading, reload } = useResource<{
    entries: AuditEntry[];
  }>("audit-logs");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [group, setGroup] = useState<AuditGroup | "">("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [datePreset, setDatePreset] = useState<string | null>("all");
  const today = vnToday();
  const datePresets: DateRangePreset[] = [
    { id: "all", label: "Mọi ngày", range: null },
    { id: "today", label: "Hôm nay", range: { from: today, to: today } },
    {
      id: "yesterday",
      label: "Hôm qua",
      range: { from: addDays(today, -1), to: addDays(today, -1) },
    },
    {
      id: "7",
      label: "7 ngày qua",
      range: { from: addDays(today, -6), to: today },
    },
    {
      id: "30",
      label: "30 ngày qua",
      range: { from: addDays(today, -29), to: today },
    },
  ];

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const rows = useMemo(
    () => filterAudit(entries, { group, actor, from, to }),
    [entries, group, actor, from, to],
  );
  // API trả mới nhất trước; bấm "Thời gian" lần đầu thì xem cũ nhất trước.
  const table = useTableState(rows, auditColumns);
  const actors = [...new Set(entries.map(auditActor))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  const groupCount = (g?: AuditGroup) =>
    entries.filter((e) => !g || auditGroup(e.action) === g).length;
  const filtered = !!(group || actor || from || to);

  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      table.resetPage();
      setSelected(null);
    };
  }
  function clearFilters() {
    setGroup("");
    setActor("");
    setFrom("");
    setTo("");
    setDatePreset("all");
    table.resetPage();
  }

  return (
    <div className="pn-page-stack">
      <PageHero
        title="Nhật ký hoạt động"
        description="Tối đa 100 thao tác gần nhất của nhà xe."
        note="Lọc, sắp xếp và phân trang tính trong 100 bản ghi đã tải."
        actions={
          <RefreshButton
            loading={loading}
            reload={() => {
              setSelected(null);
              reload();
            }}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterTabs<AuditGroup | "">
          label="Nhóm thao tác"
          value={group}
          onChange={change(setGroup)}
          items={[
            {
              value: "",
              label: "Tất cả",
              count: data ? groupCount() : undefined,
            },
            ...(Object.keys(auditGroups) as AuditGroup[]).map((g) => ({
              value: g,
              label: auditGroups[g],
              count: data ? groupCount(g) : undefined,
            })),
          ]}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs font-medium text-muted">
          <span className="block">Người thực hiện</span>
          <select
            className="field w-auto"
            value={actor}
            onChange={(e) => change(setActor)(e.target.value)}
          >
            <option value="">Mọi người</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1 text-xs font-medium text-muted">
          <span className="block" aria-hidden="true">
            Thời gian
          </span>
          <DateRangePicker
            label="Thời gian"
            align="start"
            value={from && to ? { from, to } : null}
            presetId={datePreset}
            presets={datePresets}
            max={today}
            placeholder="Mọi ngày"
            onChange={(value, id) => {
              change(setDatePreset)(id);
              setFrom(value?.from ?? "");
              setTo(value?.to ?? "");
            }}
          />
        </div>
        {filtered && (
          <button type="button" className="btn" onClick={clearFilters}>
            <X size={15} aria-hidden="true" />
            Bỏ lọc
          </button>
        )}
      </div>

      <LoadState loading={loading} error={error} reload={reload} />

      {!loading && !error && data && (
        <section className="card overflow-hidden">
          <header className="pn-table-header">
            <span className="font-bold text-ink">
              {rows.length} bản ghi
              {filtered && (
                <span className="font-normal text-muted">
                  {" "}
                  / {entries.length}
                </span>
              )}
            </span>
            <span className="text-xs text-muted">Bảo mật bất biến</span>
          </header>
          <DataTable
            label="Nhật ký hoạt động"
            columns={auditColumns}
            rows={table.visible}
            rowKey={(e) => e.id}
            sort={table.sort}
            onSort={table.onSort}
            emptyText={
              filtered
                ? "Không có bản ghi phù hợp bộ lọc."
                : "Chưa có bản ghi nhật ký."
            }
            actions={(e) => (
              <button
                type="button"
                className="btn py-1.5 text-xs"
                onClick={() => setSelected(e)}
                aria-label={`Chi tiết nhật ký ${e.id}`}
              >
                Chi tiết
              </button>
            )}
          />
          <TableFooter
            info={table.info}
            noun="bản ghi"
            note="trong dữ liệu đã tải"
            setPage={table.setPage}
            pageSize={table.pageSize}
            setPageSize={table.setPageSize}
          />
        </section>
      )}

      {selected && !error && !loading && (
        <Modal title="Chi tiết nhật ký" onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-line/60 bg-surface/30 p-4">
              <span
                className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${getActionColor(
                  selected.action,
                )}`}
              >
                {labels[selected.action] || selected.action}
              </span>
              <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock size={13} aria-hidden="true" />
                  <span>{vnDateTime(selected.at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User size={13} aria-hidden="true" />
                  <span>{selected.actor_name || "Hệ thống"}</span>
                </div>
              </div>
              <p className="mt-2.5 break-all font-mono text-xs text-muted">
                Mã đối tượng:{" "}
                <span className="text-ink font-semibold">
                  {selected.entity_id || "—"}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                <Code2 size={14} aria-hidden="true" />
                <span>Dữ liệu thao tác (Payload)</span>
              </div>
              <pre className="max-h-80 overflow-auto rounded-xl border border-line/60 bg-surface p-4 font-mono text-xs leading-relaxed text-ink/90 whitespace-pre-wrap break-all ">
                {JSON.stringify(selected.data || {}, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
