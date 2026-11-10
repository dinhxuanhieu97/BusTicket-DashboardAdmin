export type TripPeriod = "day" | "month" | "year";
export function tripPeriodRange(date: string, period: TripPeriod) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("Ngày không hợp lệ.");
  const [year, month] = date.split("-").map(Number);
  const from =
    period === "year"
      ? `${year}-01-01`
      : period === "month"
        ? date.slice(0, 7) + "-01"
        : date;
  const to = new Date(
    Date.UTC(
      year,
      period === "year" ? 12 : period === "month" ? month : month - 1,
      period === "day" ? Number(date.slice(8)) + 1 : 1,
    ),
  )
    .toISOString()
    .slice(0, 10);
  return { from, to };
}
