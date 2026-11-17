import { AssignedTrips } from "@/components/live/assigned-trips";
import { hasPermission } from "@/lib/access-policy";
import { requirePagePermission } from "@/lib/server/page-access";
export default async function Page() {
  const session = await requirePagePermission("trip.assigned.read");
  if (!session) return null;
  return (
    <AssignedTrips canBoard={hasPermission(session, "trip.assigned.board")} />
  );
}
