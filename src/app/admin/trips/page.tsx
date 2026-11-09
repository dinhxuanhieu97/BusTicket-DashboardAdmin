import { Trips } from "@/components/live/trips";
import { ownerSession } from "@/lib/server/session";
import { canManageTrips } from "@/lib/trip-management";
export default async function Page() {
  const { session } = await ownerSession();
  return (
    <Trips
      canWrite={canManageTrips(
        session,
        process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
      )}
    />
  );
}
