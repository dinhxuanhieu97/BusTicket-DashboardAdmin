import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./sparkline";

/** Thẻ số liệu: nhãn, số lớn + đơn vị, dòng chú thích và (tuỳ chọn) đường xu hướng góc phải. */
export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  foot,
  spark,
  sparkColor,
  fillSpark = true,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  foot?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  fillSpark?: boolean;
  tone?: "warning";
}) {
  return (
    <section
      className="card relative min-w-0 overflow-hidden px-5 py-4"
      aria-label={label}
    >
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon size={16} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={`mt-3 mb-3 text-[1.625rem] leading-none font-medium tracking-tight tabular-nums ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
        {unit && (
          <small className="ml-1 text-sm font-normal text-muted">{unit}</small>
        )}
      </p>
      {foot && (
        <div
          className={`flex min-h-8 flex-wrap items-center gap-2 text-xs text-muted ${spark?.length ? "pr-16 sm:pr-[7.5rem]" : ""}`}
        >
          {foot}
        </div>
      )}
      {spark && spark.length > 0 && (
        <Sparkline
          values={spark}
          color={sparkColor}
          fill={fillSpark}
          // Góc dưới phải, ngang hàng dòng chú thích: không bao giờ đè lên con số.
          className="pointer-events-none absolute right-4 bottom-4 h-8 w-12 sm:w-28"
        />
      )}
    </section>
  );
}

/** Chấm xanh nhấp nháy nhẹ cạnh "trực tiếp". */
export function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_0_4px_var(--success-bg)]"
    />
  );
}
