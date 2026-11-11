import { requirePagePermission } from "@/lib/server/page-access";
import { Trips } from "@/components/live/trips";
export default async function Page() {
  if (!(await requirePagePermission("trip.read"))) return null;
  return <Trips overview />;
}
