"use client";
import { useState } from "react";
import { AuditEntry, vnDateTime } from "@/lib/live-contracts";
import { Modal } from "../modal";
import { useResource } from "./use-resource";
import {
  LoadState,
  RefreshButton,
  EmptyRow,
  tableClass,
  thClass,
  tdClass,
} from "./shared";
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
export function Audit() {
  const { data, error, loading, reload } = useResource<{
    entries: AuditEntry[];
  }>("audit-logs");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <p className="text-sm text-muted">
          Tối đa 100 thao tác gần nhất của nhà xe.
        </p>
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
        <section className="card overflow-x-auto">
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
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className={tdClass + " whitespace-nowrap"}>
                    {vnDateTime(e.at)}
                  </td>
                  <td className={tdClass}>{labels[e.action] || e.action}</td>
                  <td className={tdClass}>{e.actor_name || "Hệ thống"}</td>
                  <td className={tdClass + " font-mono text-xs"}>{e.entity}</td>
                  <td className={tdClass}>
                    <button
                      className="text-accent"
                      onClick={() => setSelected(e)}
                      aria-label={`Xem nhật ký ${e.id}`}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
              {!data.entries.length && <EmptyRow columns={5} />}
            </tbody>
          </table>
        </section>
      )}
      {selected && !error && !loading && (
        <Modal title="Chi tiết nhật ký" onClose={() => setSelected(null)}>
          <p className="font-medium">
            {labels[selected.action] || selected.action}
          </p>
          <p className="mt-2 text-xs text-muted">
            {vnDateTime(selected.at)} · {selected.actor_name || "Hệ thống"}
          </p>
          <p className="mt-3 break-all text-sm">
            Mã đối tượng: {selected.entity_id || "—"}
          </p>
          <pre className="mt-5 max-h-80 overflow-auto rounded-xl bg-surface p-4 text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(selected.data || {}, null, 2)}
          </pre>
        </Modal>
      )}
    </div>
  );
}
