/**
 * Đồng hồ vạch 270°: vạch sáng dần tới `value` (0–1). `value = null` → mọi vạch tắt, không có núm.
 * Chỉ để nhìn; con số đọc được nằm ở `children` đặt giữa đồng hồ.
 */
export function Gauge({
  value,
  children,
  size = 240,
}: {
  value: number | null;
  children?: React.ReactNode;
  size?: number;
}) {
  const pct = value === null ? null : Math.min(1, Math.max(0, value));
  const c = size / 2;
  const r = size / 2 - 16;
  const start = 135;
  const sweep = 270;
  const ticks = 54;
  const point = (angle: number, radius: number) => {
    const a = (angle * Math.PI) / 180;
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)];
  };
  return (
    <div
      className="relative mx-auto grid w-full max-w-[15rem] place-items-center"
      data-gauge={pct === null ? "empty" : pct.toFixed(3)}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full"
        aria-hidden="true"
      >
        <circle
          cx={c}
          cy={c}
          r={r - 26}
          fill="var(--surface)"
          fillOpacity="0.5"
          stroke="var(--border)"
        />
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const on = pct !== null && pct > 0 && i / ticks <= pct;
          const [x1, y1] = point(
            start + (sweep * i) / ticks,
            r - (i % 9 ? 10 : 16),
          );
          const [x2, y2] = point(start + (sweep * i) / ticks, r);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={on ? "var(--accent)" : "var(--border-hover)"}
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity={on ? 0.45 + 0.55 * (i / ticks) : 1}
            />
          );
        })}
        {pct !== null && (
          <circle
            cx={point(start + sweep * pct, r + 2)[0]}
            cy={point(start + sweep * pct, r + 2)[1]}
            r="8"
            fill="#fff"
            stroke="var(--accent)"
            strokeWidth="3"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>{children}</div>
      </div>
    </div>
  );
}
