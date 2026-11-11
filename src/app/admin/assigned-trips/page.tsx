import { AssignedTrips } from "@/components/live/assigned-trips";
import { requirePagePermission } from "@/lib/server/page-access";
export default async function Page() {
  if (!(await requirePagePermission("trip.assigned.read"))) return null;
  return <AssignedTrips />;
}
