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
  tableClass,
  thClass,
  tdClass,
} from "./shared";
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
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Các khoản thu thực tế · Đơn vị VND
          </p>
          <p className="mt-1 text-xs text-muted">
            API trả tối đa 200 khoản gần nhất theo bộ lọc. Tìm kiếm và phân
            trang chỉ trong tập đã tải.
          </p>
        </div>
        <RefreshButton reload={refresh} loading={loading} />
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          className="field w-auto"
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
        <input
          className="field sm:max-w-sm"
          aria-label="Tìm trong khoản thu đã tải"
          placeholder="Mã đơn, tham chiếu, nội dung…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <LoadState loading={loading} error={error} reload={refresh} />
      {!loading && !error && data && (
        <section className="card">
          <header className="flex flex-wrap justify-between gap-2 p-5 text-xs text-muted">
            <span>
              {rows.length} kết quả trong {data.payments.length} khoản đã tải
            </span>
            <span>Cập nhật: {vnDateTime(data.meta.fetchedAt)}</span>
          </header>
          <div className="overflow-x-auto">
            <table className={tableClass}>
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
              <tbody>
                {rows.slice((current - 1) * 12, current * 12).map((p) => (
                  <tr key={p.id} className="hover:bg-surface">
                    <td className={tdClass}>
                      <button
                        className="text-left font-mono text-xs text-accent hover:underline"
                        onClick={() => setSelected(p)}
                        aria-label={`Chi tiết khoản thu ${p.id}`}
                      >
                        {p.matchedBookingCode || p.id.slice(0, 8)}
                      </button>
                      <p className="mt-1 max-w-44 truncate text-xs text-muted">
                        {p.bankReference || "Không có tham chiếu"}
                      </p>
                    </td>
                    <td className={tdClass + " whitespace-nowrap text-xs"}>
                      {vnDateTime(p.transactionAt)}
                    </td>
                    <td className={tdClass + " text-xs"}>
                      {methodLabels[p.method]}
                    </td>
                    <td className={tdClass + " whitespace-nowrap font-mono"}>
                      {vnd(p.amount)}
                    </td>
                    <td className={tdClass + " whitespace-nowrap font-mono"}>
                      {vnd(p.unallocatedAmount)}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`text-xs ${p.review.status === "NEEDS_REVIEW" ? "text-amber-500" : "text-emerald-500"}`}
                      >
                        {reviewLabels[p.review.status]}
                      </span>
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
          </div>
          <footer className="flex items-center justify-between p-4 text-xs text-muted">
            <span>
              Trang {current}/{pages} · Trong dữ liệu đã tải
            </span>
            <div className="flex gap-2">
              <button
                className="btn"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Trước
              </button>
              <button
                className="btn"
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
          <dl className="divide-y divide-line">
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
                className="grid grid-cols-[1fr_1.4fr] gap-3 py-3 text-sm"
              >
                <dt className="text-muted">{label}</dt>
                <dd className="text-right break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 font-bold">Phân bổ vào đơn</h3>
          {selected.allocations.length ? (
            selected.allocations.map((a, i) => (
              <div
                key={i}
                className="mt-3 flex flex-wrap justify-between gap-2 rounded-lg bg-surface p-3 text-sm"
              >
                <span>{a.bookingCode}</span>
                <span>{vnd(a.amount)}</span>
                <span className="w-full text-xs text-muted">
                  {vnDateTime(a.at)}
                </span>
              </div>
            ))
          ) : (
            <p className="mt-3 text-sm text-muted">Chưa có phân bổ.</p>
          )}
          <p className="mt-5 text-xs text-muted">
            Chế độ chỉ đọc. Chưa mở phân bổ, ghi nhận tiền hoặc đối soát.
          </p>
        </Modal>
      )}
    </div>
  );
}
