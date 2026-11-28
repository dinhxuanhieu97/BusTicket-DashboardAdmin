"use client";
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { vnDateTime, vnd } from "@/lib/live-contracts";
import {
  refundStatusLabels,
  type Refund,
  type refundsSchema,
} from "@/lib/passenger-ops";
import { localPhone } from "@/lib/trip-passengers";
import type { z } from "zod";
import { useJson } from "./assigned-trips";
import {
  LoadState,
  Notice,
  RefreshButton,
  StatusBadge,
  TableScroll,
  postJson,
  tableClass,
  tdClass,
  thClass,
} from "./shared";

/**
 * Khoản cần hoàn: đơn bị nhân viên hủy sau khi đã thu tiền, hoặc phần khách trả dư khi đổi vé/giảm số đã thu (ADJUST). Kế toán hoàn tiền ngoài hệ thống (chuyển khoản, tiền mặt)
 * rồi đánh dấu "Đã hoàn" hoặc "Không hoàn" (`payment.manage`). Hệ thống không tự chuyển tiền.
 */
export function RefundsPanel({ canManage }: { canManage: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const { data, error, loading, reload } = useJson<
    z.infer<typeof refundsSchema>
  >(`/api/refunds?status=${showAll ? "ALL" : "OPEN"}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const open = data?.refunds.filter((r) => r.status === "OPEN") ?? [];

  async function resolve(r: Refund, status: "REFUNDED" | "WAIVED") {
    setBusy(r.id);
    setMessage(null);
    try {
      await postJson(`/api/refunds/${encodeURIComponent(r.id)}/resolve`, {
        status,
      });
      setMessage({
        tone: "success",
        text: `Đơn ${r.bookingCode}: đã ghi ${refundStatusLabels[status].toLowerCase()}.`,
      });
      reload();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="refunds-heading"
      className="card pn-page-stack p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="refunds-heading" className="pn-section-label">
            Khoản cần hoàn
          </h2>
          <p className="text-sm text-muted">
            Đơn đã hủy sau khi thu tiền, hoặc khách trả dư sau khi đổi vé/giảm
            số đã thu. Hoàn cho khách ngoài hệ thống rồi đánh dấu tại đây.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Hiện cả khoản đã xử lý
          </label>
          <RefreshButton reload={reload} loading={loading} />
        </div>
      </div>
      {message && (
        <div data-message>
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {error && <LoadState error={error} reload={reload} />}
      {data && data.refunds.length === 0 && (
        <p className="text-sm text-muted">Không có khoản nào cần hoàn.</p>
      )}
      {data && data.refunds.length > 0 && (
        <>
          {open.length > 0 && (
            <p className="text-sm">
              <b>{open.length}</b> khoản chờ hoàn · tổng{" "}
              <b className="font-mono">
                {vnd(open.reduce((n, r) => n + r.amount, 0))}
              </b>
            </p>
          )}
          <TableScroll label="Danh sách khoản cần hoàn">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Mã vé</th>
                  <th className={thClass}>Khách</th>
                  <th className={`${thClass} text-right`}>Số tiền</th>
                  <th className={thClass}>Lý do</th>
                  <th className={thClass}>Trạng thái</th>
                  {canManage && (
                    <th className={thClass}>
                      <span className="sr-only">Thao tác</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.refunds.map((r) => (
                  <tr key={r.id} data-refund={r.bookingCode}>
                    <td className={`${tdClass} font-mono text-xs`}>
                      {r.bookingCode}
                    </td>
                    <td className={tdClass}>
                      {r.contactName}
                      <span className="block text-xs text-muted">
                        {r.contactErased || !r.contactPhone
                          ? "Không còn SĐT"
                          : localPhone(r.contactPhone)}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right font-mono`}>
                      {vnd(r.amount)}
                    </td>
                    <td className={`${tdClass} max-w-64 break-words`}>
                      {r.kind === "ADJUST" && (
                        <span className="block text-xs font-semibold text-warning">
                          Điều chỉnh khi đổi vé
                        </span>
                      )}
                      {r.reason}
                      <span className="block text-xs text-muted">
                        {r.createdBy ?? "—"} · {vnDateTime(r.createdAt)}
                      </span>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <StatusBadge
                        tone={r.status === "OPEN" ? "warning" : "neutral"}
                        label={refundStatusLabels[r.status]}
                      />
                      {r.resolvedAt && (
                        <span className="mt-1 block text-xs text-muted">
                          {r.resolvedBy ?? "—"} · {vnDateTime(r.resolvedAt)}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {r.status === "OPEN" && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary px-3 text-xs"
                              disabled={busy === r.id}
                              onClick={() => void resolve(r, "REFUNDED")}
                              aria-label={`Đánh dấu đã hoàn đơn ${r.bookingCode}`}
                            >
                              <Undo2 size={14} aria-hidden="true" />
                              Đã hoàn
                            </button>
                            <button
                              type="button"
                              className="btn px-3 text-xs"
                              disabled={busy === r.id}
                              onClick={() => void resolve(r, "WAIVED")}
                              aria-label={`Không hoàn đơn ${r.bookingCode}`}
                            >
                              Không hoàn
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </section>
  );
}
