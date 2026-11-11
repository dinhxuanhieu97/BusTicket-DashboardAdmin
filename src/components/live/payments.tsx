"use client";
import { useState } from "react";
import {
  Payment,
  methodLabels,
  reviewLabels,
  reasonLabels,
  vnd,
  vnDateTime,
} from "@/lib/live-contracts";
import { Modal } from "../modal";
import { useResource } from "./use-resource";
import {
  LoadState,
  RefreshButton,
  EmptyRow,
  TableScroll,
  StatusBadge,
  tableClass,
  thClass,
  tdClass,
} from "./shared";
import {
  Search,
  Receipt,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function Payments() {
  const [review, setReview] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Payment | null>(null);
  const { data, error, loading, reload } = useResource<{
    payments: Payment[];
    meta: { fetchedAt: string; limit: number };
  }>("payments" + (review ? "?review=" + review : ""));

  const rows = (data?.payments || []).filter((p) =>
    `${p.id} ${p.matchedBookingCode || ""} ${p.bankReference || ""} ${p.content || ""}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const current = Math.min(page, pages);

  const refresh = () => {
    setSelected(null);
    reload();
  };

  return (
    <div className="pn-page-stack">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="pn-section-label">Sổ thu tài chính</h2>
          <p className="text-sm text-muted">
            Các khoản thu thực tế · Đơn vị VND
          </p>
          <p className="mt-0.5 text-xs text-muted/80">
            API trả tối đa 200 khoản gần nhất theo bộ lọc. Tìm kiếm và phân
            trang chỉ trong tập đã tải.
          </p>
        </div>
        <RefreshButton reload={refresh} loading={loading} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            className="field w-auto max-w-full"
            aria-label="Trạng thái kiểm tra"
            value={review}
            onChange={(e) => {
              setReview(e.target.value);
              setPage(1);
              setSelected(null);
            }}
          >
            <option value="">Tất cả trạng thái kiểm tra</option>
            {Object.entries(reviewLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-0 basis-full sm:max-w-sm sm:basis-auto sm:flex-1">
          <input
            className="field pl-9 font-medium"
            aria-label="Tìm trong khoản thu đã tải"
            placeholder="Mã đơn, tham chiếu, nội dung…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </div>
      </div>

      <LoadState loading={loading} error={error} reload={refresh} />

      {!loading && !error && data && (
        <section className="card overflow-hidden">
          <header className="pn-table-header text-xs text-muted">
            <span className="font-medium text-ink">
              {rows.length} kết quả trong {data.payments.length} khoản đã tải
            </span>
            <span>Cập nhật: {vnDateTime(data.meta.fetchedAt)}</span>
          </header>
          <TableScroll label="Danh sách khoản thu">
            <table className={tableClass} data-pin-first>
              <thead>
                <tr>
                  {[
                    "Khoản thu / mã đơn",
                    "Thời gian giao dịch",
                    "Phương thức",
                    "Số tiền",
                    "Chưa phân bổ",
                    "Kiểm tra",
                  ].map((h) => (
                    <th className={thClass} key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {rows.slice((current - 1) * 12, current * 12).map((p) => (
                  <tr key={p.id} className="transition-colors">
                    <td className={tdClass}>
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-left font-mono text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                        onClick={() => setSelected(p)}
                        aria-label={`Chi tiết khoản thu ${p.id}`}
                      >
                        <Receipt size={13} aria-hidden="true" />
                        <span>{p.matchedBookingCode || p.id.slice(0, 8)}</span>
                      </button>
                      <p className="mt-1 max-w-44 truncate font-mono text-[11px] text-muted">
                        {p.bankReference || "Không có tham chiếu"}
                      </p>
                    </td>
                    <td
                      className={
                        tdClass +
                        " whitespace-nowrap text-xs font-mono text-muted"
                      }
                    >
                      {vnDateTime(p.transactionAt)}
                    </td>
                    <td className={tdClass + " text-xs font-medium text-ink"}>
                      <span className="rounded bg-surface px-2 py-1">
                        {methodLabels[p.method]}
                      </span>
                    </td>
                    <td
                      className={
                        tdClass +
                        " whitespace-nowrap font-mono text-sm font-bold text-ink"
                      }
                    >
                      {vnd(p.amount)}
                    </td>
                    <td
                      className={
                        tdClass + " whitespace-nowrap font-mono text-sm"
                      }
                    >
                      <span
                        className={
                          p.unallocatedAmount > 0
                            ? "text-warning font-semibold"
                            : "text-muted"
                        }
                      >
                        {vnd(p.unallocatedAmount)}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge
                        tone={
                          p.review.status === "NEEDS_REVIEW"
                            ? "warning"
                            : "success"
                        }
                        label={reviewLabels[p.review.status]}
                      />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <EmptyRow
                    columns={6}
                    text="Không có khoản thu phù hợp trong dữ liệu đã tải."
                  />
                )}
              </tbody>
            </table>
          </TableScroll>
          <footer className="pn-table-footer">
            <span className="font-medium">
              Trang {current}/{pages} · Trong dữ liệu đã tải
            </span>
            <div className="flex gap-2">
              <button
                className="btn py-1.5 text-xs"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Trước
              </button>
              <button
                className="btn py-1.5 text-xs"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Sau
              </button>
            </div>
          </footer>
        </section>
      )}

      {selected && !loading && !error && (
        <Modal title="Chi tiết khoản thu" onClose={() => setSelected(null)}>
          <div className="space-y-5">
            <div className="rounded-xl border border-line/60 bg-surface/20 p-4">
              <dl className="divide-y divide-line/40">
                {[
                  ["Mã khoản thu", selected.id],
                  [
                    "Mã đơn nhận diện",
                    selected.matchedBookingCode || "Chưa nhận diện",
                  ],
                  ["Phương thức", methodLabels[selected.method]],
                  ["Số tiền", vnd(selected.amount)],
                  ["Đã phân bổ", vnd(selected.allocatedAmount)],
                  ["Chưa phân bổ", vnd(selected.unallocatedAmount)],
                  ["Nội dung", selected.content || "—"],
                  ["Tham chiếu ngân hàng", selected.bankReference || "—"],
                  ["Giao dịch lúc", vnDateTime(selected.transactionAt)],
                  ["Tiếp nhận lúc", vnDateTime(selected.receivedAt)],
                  ["Kiểm tra", reviewLabels[selected.review.status]],
                  [
                    "Lý do",
                    selected.review.reason
                      ? reasonLabels[selected.review.reason] ||
                        selected.review.reason
                      : "—",
                  ],
                  ["Ghi chú kiểm tra", selected.review.note || "—"],
                  ["Người ghi nhận", selected.recordedBy || "Hệ thống"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[1fr_1.4fr] gap-3 py-2.5 text-sm"
                  >
                    <dt className="text-xs font-medium text-muted">{label}</dt>
                    <dd className="break-words text-right font-medium text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Phân bổ vào đơn</h3>
              {selected.allocations.length ? (
                selected.allocations.map((a, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-surface/30 p-3.5 text-sm"
                  >
                    <span className="font-mono font-semibold text-accent">
                      {a.bookingCode}
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {vnd(a.amount)}
                    </span>
                    <span className="w-full text-xs text-muted">
                      {vnDateTime(a.at)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-line/60 p-4 text-center text-sm text-muted">
                  Chưa có phân bổ.
                </p>
              )}
            </div>

            <p className="border-t border-line/60 pt-3 text-xs leading-relaxed text-muted">
              Chế độ chỉ đọc. Chưa mở phân bổ, ghi nhận tiền hoặc đối soát.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
