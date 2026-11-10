import { Trips } from "@/components/live/trips";
import { ownerSession } from "@/lib/server/session";
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
  const { session } = await ownerSession();
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
