"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  nextSort,
  pageInfo,
  pageSlice,
  rangeText,
  sortRows,
  type PageInfo,
  type Sort,
  type SortValue,
} from "@/lib/table-state";
import { EmptyRow, TableScroll, tableClass, tdClass, thClass } from "./shared";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Có hàm này thì cột sắp xếp được. */
  sortValue?: (row: T) => SortValue;
  align?: "left" | "right";
  className?: string;
};

/**
 * Sắp xếp + phân trang trên dữ liệu đã tải (T1). Đổi tập dòng (lọc, tìm) thì gọi `resetPage`;
 * trang hiện tại cũng tự kẹp vào số trang mới.
 */
export function useTableState<T>(
  rows: readonly T[],
  columns: Column<T>[],
  initial: { sort?: Sort; pageSize?: number } = {},
) {
  const [sort, setSort] = useState<Sort>(initial.sort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    initial.pageSize ?? DEFAULT_PAGE_SIZE,
  );
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, (row, key) =>
        columns.find((c) => c.key === key)?.sortValue?.(row),
      ),
    [rows, sort, columns],
  );
  const info = pageInfo(sorted.length, page, pageSize);
  return {
    sort,
    onSort: (key: string) => {
      setSort((s) => nextSort(s, key));
      setPage(1);
    },
    info,
    visible: pageSlice(sorted, info),
    setPage,
    resetPage: () => setPage(1),
    pageSize,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
  };
}

const sortLabel = { asc: "tăng dần", desc: "giảm dần" } as const;

function SortHeader({
  header,
  dir,
  onClick,
}: {
  header: string;
  dir: "asc" | "desc" | undefined;
  onClick: () => void;
}) {
  const Icon =
    dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      className="pn-sort"
      data-active={dir ? "" : undefined}
      onClick={onClick}
    >
      {header}
      <Icon size={13} aria-hidden="true" />
      {dir && <span className="sr-only">, đang {sortLabel[dir]}</span>}
    </button>
  );
}

export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  emptyText,
  actions,
}: {
  label: string;
  columns: Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  sort: Sort;
  onSort: (key: string) => void;
  emptyText: string;
  /** Cột thao tác cuối dòng (T1: chỉ "Chi tiết"). */
  actions?: (row: T) => ReactNode;
}) {
  const width = columns.length + (actions ? 1 : 0);
  const alignClass = (c: Column<T>) =>
    c.align === "right" ? " text-right" : "";
  return (
    <TableScroll label={label}>
      <table className={tableClass} data-pin-first>
        <thead>
          <tr>
            {columns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={thClass + alignClass(c)}
                  aria-sort={
                    c.sortValue
                      ? dir === "asc"
                        ? "ascending"
                        : dir === "desc"
                          ? "descending"
                          : "none"
                      : undefined
                  }
                >
                  {c.sortValue ? (
                    <SortHeader
                      header={c.header}
                      dir={dir}
                      onClick={() => onSort(c.key)}
                    />
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {actions && (
              <th scope="col" className={thClass + " text-right"}>
                <span className="sr-only">Thao tác</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={
                    tdClass + alignClass(c) + " " + (c.className ?? "")
                  }
                >
                  {c.render(row)}
                </td>
              ))}
              {actions && (
                <td className={tdClass + " text-right whitespace-nowrap"}>
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <EmptyRow columns={width} text={emptyText} />}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** Chân bảng: "1–25 trên 141 khoản thu", Trước/Sau, chọn số dòng mỗi trang. */
export function TableFooter({
  info,
  noun,
  setPage,
  pageSize,
  setPageSize,
  note,
}: {
  info: PageInfo;
  noun: string;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  note?: string;
}) {
  return (
    <footer className="pn-table-footer">
      <span className="font-medium" aria-live="polite">
        {rangeText(info, noun)}
        {note ? ` · ${note}` : ""}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span>Số dòng</span>
          <select
            className="field h-8 w-auto py-0 pr-7 text-xs"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / trang
              </option>
            ))}
          </select>
        </label>
        <span>
          Trang {info.page}/{info.pages}
        </span>
        <button
          type="button"
          className="btn py-1.5 text-xs"
          disabled={info.page === 1}
          onClick={() => setPage(info.page - 1)}
        >
          Trước
        </button>
        <button
          type="button"
          className="btn py-1.5 text-xs"
          disabled={info.page === info.pages}
          onClick={() => setPage(info.page + 1)}
        >
          Sau
        </button>
      </div>
    </footer>
  );
}
