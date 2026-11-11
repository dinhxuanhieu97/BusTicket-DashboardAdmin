import { Trips } from "@/components/live/trips";
import { requirePagePermission } from "@/lib/server/page-access";
import { canManageTrips } from "@/lib/trip-management";
import { tripPeriodRange, type TripPeriod } from "@/lib/trip-period";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const initialPeriod: TripPeriod =
    query.period === "month" || query.period === "year" ? query.period : "day";
  let initialDate: string | undefined;
  if (typeof query.date === "string") {
    try {
      tripPeriodRange(query.date, initialPeriod);
      initialDate = query.date;
    } catch {
      /* use today */
    }
  }
  const session = await requirePagePermission("trip.read");
  if (!session) return null;
  return (
    <Trips
      initialDate={initialDate}
      initialPeriod={initialPeriod}
      canWrite={canManageTrips(
        session,
        process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
      )}
    />
  );
}
