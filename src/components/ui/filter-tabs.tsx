"use client";

export type FilterTab<T extends string> = {
  value: T;
  label: string;
  /** Số bản ghi; `undefined` = chưa biết (không hiện huy hiệu). */
  count?: number;
  /** Số đếm là giới hạn dưới (tập đã tải bị cắt), hiện thêm dấu "+". */
  partial?: boolean;
};

/** Nhóm nút lọc dạng tab có huy hiệu đếm. Dùng `aria-pressed` vì cả nhóm chỉ lọc một danh sách. */
export function FilterTabs<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: FilterTab<T>[];
}) {
  return (
    <div className="pn-tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="pn-tabs-count" data-testid="tab-count">
              {item.count}
              {item.partial ? "+" : ""}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
