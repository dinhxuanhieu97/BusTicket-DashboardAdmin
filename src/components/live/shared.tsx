"use client";
import { RefreshCw } from "lucide-react";
export function LoadState({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string;
  reload: () => void;
}) {
  if (loading)
    return (
      <div className="card p-12 text-center text-muted" role="status">
        Đang đọc dữ liệu từ API…
      </div>
    );
  if (error)
    return (
      <div className="card p-8">
        <p role="alert" className="text-sm text-amber-400">
          {error}
        </p>
        <p className="mt-2 text-xs text-muted">
          Vui lòng kiểm tra kết nối và thử lại.
        </p>
        <button className="btn mt-4" onClick={reload}>
          Thử lại
        </button>
      </div>
    );
  return null;
}
export function RefreshButton({
  reload,
  loading,
}: {
  reload: () => void;
  loading: boolean;
}) {
  return (
    <button className="btn" disabled={loading} onClick={reload}>
      <RefreshCw size={15} />
      Làm mới
    </button>
  );
}
export function EmptyRow({
  columns,
  text = "Chưa có dữ liệu.",
}: {
  columns: number;
  text?: string;
}) {
  return (
    <tr>
      <td colSpan={columns} className="p-10 text-center text-muted">
        {text}
      </td>
    </tr>
  );
}
export const tableClass = "w-full min-w-[650px] text-left text-sm";
export const thClass =
  "border-b border-line px-5 py-3 text-xs font-semibold text-muted";
export const tdClass = "border-b border-line px-5 py-4 text-sm";
