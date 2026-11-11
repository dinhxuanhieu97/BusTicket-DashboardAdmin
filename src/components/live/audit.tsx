"use client";
import { useState } from "react";
import { AuditEntry, vnDateTime } from "@/lib/live-contracts";
import { Modal } from "../modal";
import { useResource } from "./use-resource";
import {
  LoadState,
  RefreshButton,
  EmptyRow,
  TableScroll,
  tableClass,
  thClass,
  tdClass,
} from "./shared";
import { Clock, User, FileText, Code2 } from "lucide-react";

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="pn-section-label">Nhật ký hoạt động</h2>
          <p className="text-sm text-muted">
            Tối đa 100 thao tác gần nhất của nhà xe.
          </p>
        </div>
        <RefreshButton
          loading={loading}
          reload={() => {
            setSelected(null);
            reload();
          }}
        />
      </div>

      <LoadState loading={loading} error={error} reload={reload} />

      {!loading && !error && data && (
        <section className="card overflow-hidden">
          <header className="pn-table-header">
            <span className="font-bold text-ink">
              {data.entries.length} bản ghi
            </span>
            <span className="text-xs text-muted">Bảo mật bất biến</span>
          </header>
          <TableScroll label="Bảng nhật ký hoạt động">
            <table className={tableClass}>
              <thead>
                <tr>
                  {[
                    "Thời gian",
                    "Thao tác",
                    "Người thực hiện",
                    "Đối tượng",
                    "Chi tiết",
                  ].map((h) => (
                    <th className={thClass} key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {data.entries.map((e) => (
                  <tr key={e.id} className="transition-colors">
                    <td className={tdClass + " whitespace-nowrap"}>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-muted">
                        <Clock size={13} aria-hidden="true" />
                        <span>{vnDateTime(e.at)}</span>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${getActionColor(
                          e.action,
                        )}`}
                      >
                        {labels[e.action] || e.action}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <User
                          size={13}
                          className="text-muted"
                          aria-hidden="true"
                        />
                        <span>{e.actor_name || "Hệ thống"}</span>
                      </div>
                    </td>
                    <td className={tdClass + " font-mono text-xs text-muted"}>
                      <span className="rounded bg-surface px-2 py-0.5">
                        {e.entity}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <button
                        className="btn py-1 text-xs text-accent hover:border-accent"
                        onClick={() => setSelected(e)}
                        aria-label={`Xem nhật ký ${e.id}`}
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
                {!data.entries.length && (
                  <EmptyRow columns={5} text="Chưa có bản ghi nhật ký." />
                )}
              </tbody>
            </table>
          </TableScroll>
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
