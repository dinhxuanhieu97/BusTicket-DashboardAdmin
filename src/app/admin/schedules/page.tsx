import { ScheduleManager } from "@/components/live/schedule-manager";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/server/page-access";
import { canManageTrips } from "@/lib/trip-management";

export default async function Page() {
  const session = await requirePagePermission("trip.write");
  if (!session) return null;
  if (!canManageTrips(session, process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID))
    redirect("/admin/settings");
  return <ScheduleManager />;
}
