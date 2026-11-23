/**
 * Chỉ số các nhãn trục X sẽ hiện: tối đa `max` nhãn (mặc định 7: tuần đủ 7 ngày), luôn có nhãn đầu và cuối.
 * Nhãn áp chót bị bỏ nếu quá sát nhãn cuối (cách nhau dưới nửa bước) để hai nhãn không đè nhau.
 */
export function axisTicks(count: number, max = 7): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (max - 1));
  const ticks: number[] = [];
  for (let i = 0; i < count - 1; i += step) ticks.push(i);
  const last = count - 1;
  if (last - ticks[ticks.length - 1] < step / 2 && ticks.length > 1)
    ticks.pop();
  ticks.push(last);
  return ticks;
}

/** Vị trí nhãn theo phần trăm chiều ngang, khớp tọa độ điểm dữ liệu của biểu đồ. */
export const tickPercent = (index: number, count: number) =>
  count <= 1 ? 0 : (index / (count - 1)) * 100;
