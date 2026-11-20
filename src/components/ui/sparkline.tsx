import { useId } from "react";

/** Đường xu hướng nhỏ trong thẻ số liệu. Chỉ để nhìn: số thật nằm ở chữ của thẻ. */
export function Sparkline({
  values,
  color = "var(--accent)",
  fill = true,
  className = "",
}: {
  values: number[];
  color?: string;
  fill?: boolean;
  className?: string;
}) {
  const id = useId();
  if (!values.length) return null;
  const w = 120;
  const h = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  // Một điểm hoặc toàn số bằng nhau: vẽ đường ngang giữa khung thay vì chia cho 0.
  const points =
    values.length === 1 ? [values[0], values[0]] : values.map((v) => v);
  const xy = points.map((v, i) => [
    (i / (points.length - 1)) * w,
    max === min ? h / 2 : h - 4 - ((v - min) / span) * (h - 10),
  ]);
  const d = xy
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      data-sparkline
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${w} ${h} L0 ${h}Z`} fill={`url(#${id})`} />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
