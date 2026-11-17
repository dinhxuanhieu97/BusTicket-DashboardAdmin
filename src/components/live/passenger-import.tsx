"use client";
import { useState } from "react";
import { FileUp } from "lucide-react";
import { vnd } from "@/lib/live-contracts";
import {
  IMPORT_MAX_BYTES,
  XLSX_TYPE,
  bookingStatusText,
  type ImportPreview,
  type ImportResult,
  type Issue,
} from "@/lib/staff-booking";
import { localPhone } from "@/lib/trip-passengers";
import { Notice, TableScroll, tableClass, tdClass, thClass } from "./shared";

type Failure = { message: string; issues: Issue[] };

/**
 * Nhập khách mới từ file Excel (cùng cột với file xuất). Bước 1 kiểm tra (không ghi); bước 2 ghi tất cả hoặc không
 * ghi gì. Dòng có Mã vé là khách đã có đơn: chỉ đếm, chưa cập nhật.
 */
export function PassengerImport({
  tripId,
  onImported,
  onClose,
}: {
  tripId: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"confirm" | "hold">("confirm");
  const [notify, setNotify] = useState(true);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/trip-management/${encodeURIComponent(tripId)}/passengers`;

  const reset = () => {
    setPreview(null);
    setFailure(null);
  };

  async function send<T>(dryRun: boolean): Promise<T | null> {
    if (!file) return null;
    if (file.size > IMPORT_MAX_BYTES) {
      setFailure({ message: "Tệp quá lớn (tối đa 2 MB).", issues: [] });
      return null;
    }
    const q = new URLSearchParams({
      dryRun: String(dryRun),
      confirm: String(mode === "confirm"),
      notify: String(notify),
      name: file.name.slice(0, 200),
    });
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`${base}/import?${q}`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": XLSX_TYPE },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) window.location.replace("/login");
      if (!res.ok) {
        setFailure({
          message: data.error?.message ?? "Không nhập được file.",
          issues: data.error?.issues ?? [],
        });
        return null;
      }
      return data as T;
    } catch {
      setFailure({ message: "Mất kết nối. Vui lòng thử lại.", issues: [] });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setPreview(await send<ImportPreview>(true));
  }
  async function commit() {
    const r = await send<ImportResult>(false);
    if (r) {
      setResult(r);
      setPreview(null);
      onImported();
    } else setPreview(null);
  }

  if (result)
    return (
      <div
        className="pn-page-stack rounded-xl border border-line/60 p-4"
        aria-labelledby="import-heading"
        role="region"
      >
        <h4 id="import-heading" className="text-sm font-semibold">
          Nhập danh sách khách mới
        </h4>
        <Notice tone="success">
          <p className="font-semibold">
            {result.replayed
              ? `File này đã được nhập trước đó (${result.bookings.length} đơn) — không tạo đơn trùng.`
              : `Đã nhập ${result.bookings.length} đơn mới.`}
          </p>
          <p className="mt-1 font-mono text-xs">
            {result.bookings.map((b) => b.code).join(", ")}
          </p>
        </Notice>
        <div>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    );

  return (
    <div
      className="pn-page-stack rounded-xl border border-line/60 p-4"
      aria-labelledby="import-heading"
      role="region"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="import-heading" className="text-sm font-semibold">
            Nhập danh sách khách mới
          </h4>
          <p className="mt-0.5 text-xs text-muted">
            Dùng file mẫu trống hoặc file đã xuất (thêm dòng mới, để trống Mã
            vé). Kiểm tra trước, chưa ghi gì cho đến khi bạn bấm ghi.
          </p>
        </div>
        <a className="btn px-3 text-xs" href={`${base}/template`} download>
          Tải file mẫu trống
        </a>
      </div>

      <div className="grid gap-3">
        <div>
          <label htmlFor="import-file" className="label mb-1.5">
            Tệp Excel (.xlsx, tối đa 2 MB)
          </label>
          <input
            id="import-file"
            type="file"
            className="field w-full"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              reset();
            }}
          />
        </div>
        <div>
          <span className="label mb-1.5">Đơn mới</span>
          <div className="pn-segmented" role="group" aria-label="Đơn mới">
            {(
              [
                ["confirm", "Xác nhận ngay"],
                ["hold", "Giữ chỗ chờ chuyển khoản"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  reset();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => {
              setNotify(e.target.checked);
              reset();
            }}
          />
          Gửi tin xác nhận cho khách
        </label>
      </div>

      {failure && (
        <Notice tone="danger">
          <p>{failure.message}</p>
          {failure.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {failure.issues.map((i, n) => (
                <li key={n}>{i.message}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      {preview && <PreviewBody preview={preview} />}

      <div className="flex flex-wrap gap-2">
        {preview?.ok ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void commit()}
          >
            {busy ? "Đang ghi…" : `Ghi ${preview.totals.bookings} đơn`}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !file}
            onClick={() => void check()}
          >
            <FileUp size={15} aria-hidden="true" />
            {busy
              ? "Đang kiểm tra…"
              : preview
                ? "Kiểm tra lại"
                : "Kiểm tra file"}
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Hủy
        </button>
      </div>
    </div>
  );
}

function PreviewBody({ preview }: { preview: ImportPreview }) {
  return (
    <div className="pn-page-stack" aria-live="polite">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li>
          <b>{preview.file.newRows}</b> dòng khách mới →{" "}
          <b>{preview.totals.bookings}</b> đơn · {preview.totals.seats} chỗ
        </li>
        <li>
          Tổng tiền{" "}
          <b className="font-mono">{vnd(preview.totals.totalAmount)}</b> · đã
          thu {vnd(preview.totals.paidAmount)}
        </li>
      </ul>
      {preview.file.existingRows > 0 && (
        <Notice tone="info">
          {preview.file.existingRows} dòng có Mã vé là khách đã có đơn — lần này
          bỏ qua (cập nhật lên xe, thực thu sẽ có ở bản sau).
        </Notice>
      )}
      {preview.issues.length > 0 && (
        <Notice tone="danger">
          <p>
            Còn {preview.issues.length} lỗi. Sửa file rồi kiểm tra lại; chưa
            dòng nào được ghi.
          </p>
          <ul className="mt-1 list-disc pl-5" data-import-issues>
            {preview.issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </Notice>
      )}
      {preview.warnings.length > 0 && (
        <Notice tone="warning">
          <ul className="list-disc pl-5">
            {preview.warnings.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </Notice>
      )}
      {preview.bookings.length > 0 && (
        <TableScroll label="Đơn sẽ tạo">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Dòng</th>
                <th className={thClass}>Khách</th>
                <th className={thClass}>Chỗ</th>
                <th className={thClass}>Điểm đón</th>
                <th className={thClass}>Đơn</th>
                <th className={`${thClass} text-right`}>Tổng</th>
                <th className={`${thClass} text-right`}>Còn thu</th>
              </tr>
            </thead>
            <tbody>
              {preview.bookings.map((b) => (
                <tr key={b.rows.join("-")}>
                  <td className={`${tdClass} font-mono text-xs`}>
                    {b.rows.join(", ")}
                  </td>
                  <td className={tdClass}>
                    {b.contactName}
                    <span className="block text-xs text-muted">
                      {localPhone(b.contactPhone)}
                    </span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-mono`}>
                    {b.seats
                      .map(
                        (s) =>
                          s.code + (s.occupancy > 1 ? ` (${s.occupancy})` : ""),
                      )
                      .join(", ")}
                  </td>
                  <td className={tdClass}>{b.pickupStop?.name ?? "—"}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {bookingStatusText[b.status]}
                  </td>
                  <td className={`${tdClass} text-right font-mono`}>
                    {vnd(b.totalAmount)}
                  </td>
                  <td className={`${tdClass} text-right font-mono`}>
                    {vnd(b.dueAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
