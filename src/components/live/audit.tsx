"use client";
import { useState } from "react";
import { AuditEntry, vnDateTime } from "@/lib/live-contracts";
import { Modal } from "../modal";
import { useResource } from "./use-resource";
import { LoadState, RefreshButton, EmptyState } from "./shared";
import { PageHero } from "../ui/page-hero";
import {
  Bus,
  Clock,
  Code2,
  FileText,
  Route,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

function actionIcon(action: string): LucideIcon {
  if (action.startsWith("trip.")) return Bus;
  if (action.startsWith("payment.")) return Wallet;
  if (action.startsWith("user.")) return User;
  if (action.startsWith("vehicle.")) return Warehouse;
  if (action.startsWith("route.")) return Route;
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

export function Audit() {
  const { data, error, loading, reload } = useResource<{
    entries: AuditEntry[];
  }>("audit-logs");
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  return (
    <div className="pn-page-stack">
      <PageHero
        title="Nhật ký hoạt động"
        description="Tối đa 100 thao tác gần nhất của nhà xe."
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

      <LoadState loading={loading} error={error} reload={reload} />

      {!loading && !error && data && (
        <section className="card overflow-hidden">
          <header className="pn-table-header">
            <span className="font-bold text-ink">
              {data.entries.length} bản ghi
            </span>
            <span className="text-xs text-muted">Bảo mật bất biến</span>
          </header>
          {data.entries.length ? (
            <ul className="pn-panel-inline" aria-label="Nhật ký hoạt động">
              {data.entries.map((e) => {
                const Icon = actionIcon(e.action);
                return (
                  <li key={e.id} className="pn-list-row">
                    <span className="pn-list-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {labels[e.action] || e.action}
                      </p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <User size={12} aria-hidden="true" />
                          {e.actor_name || "Hệ thống"}
                        </span>
                        <span className="font-mono">{e.entity}</span>
                        <span className="font-mono sm:hidden">
                          {vnDateTime(e.at)}
                        </span>
                      </p>
                    </div>
                    <span className="hidden font-mono text-xs whitespace-nowrap text-muted sm:inline">
                      {vnDateTime(e.at)}
                    </span>
                    <button
                      type="button"
                      className="btn py-1 text-xs text-accent hover:border-accent"
                      onClick={() => setSelected(e)}
                      aria-label={`Xem nhật ký ${e.id}`}
                    >
                      Xem
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>
              <p>Chưa có bản ghi nhật ký.</p>
            </EmptyState>
          )}
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
