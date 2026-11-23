import { axisTicks } from "@/lib/chart-ticks";

export type TrendSeries = {
  name: string;
  values: number[];
};

/**
 * Cột theo ngày + đường chấm kỳ trước. Mỗi ngày một cột (ngày 0 vẫn thấy là 0), nhãn trục X đặt giữa
 * từng cột, tối đa 7 nhãn. Chỉ cột màu thương hiệu (chuỗi chính); kỳ trước là nét xám, không tô màu.
 * Bảng `sr-only` cho trình đọc màn hình.
 */
export function BarTrendChart({
  labels,
  current,
  previous,
  caption,
  format = (v) => v.toLocaleString("vi-VN"),
}: {
  labels: string[];
  current: number[];
  previous: number[];
  caption: string;
  format?: (value: number) => string;
}) {
  const w = 600;
  const h = 200;
  const n = Math.max(1, labels.length);
  const max = Math.max(1, ...current, ...previous);
  const slot = w / n;
  const barW = Math.max(2, Math.min(36, slot * 0.6));
  const cx = (i: number) => (i + 0.5) * slot;
  const y = (v: number) => h - 6 - (v / max) * (h - 16);
  const ticks = axisTicks(labels.length);
  const prevPath = previous
    .map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  return (
    <figure className="relative min-w-0" data-bar-chart>
      <div className="relative">
        <span className="absolute top-0 left-0 text-[11px] text-muted tabular-nums">
          {format(max)}
        </span>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="block h-48 w-full sm:h-56"
          aria-hidden="true"
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1="0"
              x2={w}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1="0"
            x2={w}
            y1={h - 6}
            y2={h - 6}
            stroke="var(--border-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {current.map((v, i) =>
            v > 0 ? (
              <rect
                key={labels[i] + i}
                x={cx(i) - barW / 2}
                y={y(v)}
                width={barW}
                height={h - 6 - y(v)}
                rx="3"
                fill="var(--accent)"
              />
            ) : null,
          )}
          {n > 1 && (
            <path
              d={prevPath}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              strokeDasharray="5 5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <div
        className="relative mt-2 h-4 text-[11px] text-muted tabular-nums"
        data-axis-x
      >
        {ticks.map((i) => (
          <span
            key={i}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((i + 0.5) / n) * 100}%` }}
          >
            {labels[i]}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="12" height="10" aria-hidden="true">
            <rect width="12" height="10" rx="2" fill="var(--accent)" />
          </svg>
          Kỳ này
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="4" aria-hidden="true">
            <line
              x1="0"
              x2="18"
              y1="2"
              y2="2"
              stroke="var(--muted)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Kỳ trước
        </span>
      </figcaption>
      {/* `sr-only` đặt trên div: bảng bỏ qua width 1px nên sẽ làm trang rộng ra. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Ngày</th>
              <th scope="col">Kỳ này</th>
              <th scope="col">Kỳ trước</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label + i}>
                <th scope="row">{label}</th>
                <td>{format(current[i] ?? 0)}</td>
                <td>{format(previous[i] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
