import { useId } from "react";

export type ChartSeries = {
  name: string;
  values: number[];
  color: string;
  dashed?: boolean;
};

/**
 * Biểu đồ vùng SVG tự vẽ: series đầu tô nền, các series sau chỉ vẽ đường (nét đứt nếu `dashed`).
 * Nhãn trục nằm ngoài SVG (HTML) để không bị kéo giãn; bảng `sr-only` cho trình đọc màn hình.
 */
export function AreaChart({
  labels,
  series,
  caption,
  format = (v) => v.toLocaleString("vi-VN"),
}: {
  labels: string[];
  series: ChartSeries[];
  caption: string;
  format?: (value: number) => string;
}) {
  const id = useId();
  const w = 600;
  const h = 200;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = Math.max(2, labels.length);
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => h - 6 - (v / max) * (h - 16);
  const line = (values: number[]) =>
    (values.length === 1 ? [values[0], values[0]] : values)
      .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
  // Nhãn trục X thưa dần khi nhiều ngày để không chồng lên nhau.
  const step = labels.length > 10 ? Math.ceil(labels.length / 6) : 1;

  return (
    <figure className="relative min-w-0" data-area-chart>
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
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={series[0]?.color} stopOpacity=".32" />
              <stop offset="1" stopColor={series[0]?.color} stopOpacity="0" />
            </linearGradient>
          </defs>
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
          {series[0] && (
            <path
              d={`${line(series[0].values)} L${x(Math.max(1, series[0].values.length - 1))} ${h} L0 ${h} Z`}
              fill={`url(#${id})`}
            />
          )}
          {series.map((s) => (
            <path
              key={s.name}
              d={line(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeDasharray={s.dashed ? "5 5" : undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between gap-1 text-[11px] text-muted tabular-nums">
        {labels.map((label, i) => (
          <span
            key={label + i}
            className={i % step && i !== labels.length - 1 ? "invisible" : ""}
          >
            {label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            <svg width="18" height="4" aria-hidden="true">
              <line
                x1="0"
                x2="18"
                y1="2"
                y2="2"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dashed ? "4 3" : undefined}
              />
            </svg>
            {s.name}
          </span>
        ))}
      </figcaption>
      {/* `sr-only` đặt trên div: bảng bỏ qua width 1px nên sẽ làm trang rộng ra. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Ngày</th>
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label + i}>
                <th scope="row">{label}</th>
                {series.map((s) => (
                  <td key={s.name}>{format(s.values[i] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
