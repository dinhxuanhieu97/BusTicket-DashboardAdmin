/**
 * Trạng thái bảng dùng chung (T1): sắp xếp và phân trang trên dữ liệu đã tải.
 * Hàm thuần để test được; component `DataTable` chỉ hiển thị.
 */
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES = [10, 25, 50] as const;

export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir } | null;
export type SortValue = string | number | null | undefined;

/** Bấm tiêu đề cột: chưa sắp xếp → tăng → giảm → bỏ. Cột khác thì bắt đầu lại từ tăng. */
export function nextSort(current: Sort, key: string): Sort {
  if (!current || current.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

const collator = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
});

/** So sánh hai giá trị; ô trống luôn nằm cuối dù tăng hay giảm. */
function compare(a: SortValue, b: SortValue, dir: SortDir) {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const n =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : collator.compare(String(a), String(b));
  return dir === "asc" ? n : -n;
}

/** Sắp xếp ổn định (giữ thứ tự gốc khi bằng nhau); không sắp xếp thì trả đúng mảng đầu vào. */
export function sortRows<T>(
  rows: readonly T[],
  sort: Sort,
  valueOf: (row: T, key: string) => SortValue,
): readonly T[] {
  if (!sort) return rows;
  return rows
    .map((row, i) => ({ row, i, v: valueOf(row, sort.key) }))
    .sort((x, y) => compare(x.v, y.v, sort.dir) || x.i - y.i)
    .map((x) => x.row);
}

export type PageInfo = {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
};

/** Trang hiện tại bị kẹp vào [1, số trang] (khi lọc làm ít dòng đi). */
export function pageInfo(total: number, page: number, size: number): PageInfo {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const from = total ? (current - 1) * size + 1 : 0;
  return {
    page: current,
    pages,
    from,
    to: Math.min(total, current * size),
    total,
  };
}

export function pageSlice<T>(rows: readonly T[], info: PageInfo): T[] {
  return info.total ? rows.slice(info.from - 1, info.to) : [];
}

/** "1–25 trên 141 khoản thu" (dấu chấm phân cách nghìn như vi-VN). */
export function rangeText(info: PageInfo, noun: string) {
  const f = (n: number) => n.toLocaleString("vi-VN");
  if (!info.total) return `0 ${noun}`;
  return `${f(info.from)}–${f(info.to)} trên ${f(info.total)} ${noun}`;
}

export function parsePageSize(raw: unknown): number {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
