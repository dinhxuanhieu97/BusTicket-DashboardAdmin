"use client";

/** Chip lọc chọn một; trên điện thoại cuộn ngang thay vì xuống nhiều dòng. */
export function FilterChips({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="pn-filter-chips" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className="pn-filter-chip"
          aria-pressed={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="text-xs opacity-70">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
