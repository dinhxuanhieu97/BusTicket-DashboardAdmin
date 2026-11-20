import { SeatBoard } from "@/components/live/seat-board";
import { hasPermission } from "@/lib/access-policy";
import { requirePagePermission } from "@/lib/server/page-access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const session = await requirePagePermission("trip.read");
  if (!session) return null;
  return (
    <SeatBoard
      canCreateBookings={hasPermission(session, "booking.create")}
      canReadPassengers={hasPermission(session, "booking.read")}
      initialDate={
        typeof query.date === "string" && DATE.test(query.date)
          ? query.date
          : undefined
      }
      initialTripId={
        typeof query.trip === "string" && UUID.test(query.trip)
          ? query.trip
          : undefined
      }
    />
  );
}
