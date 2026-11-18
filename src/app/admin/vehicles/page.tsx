import { VehicleManager } from "@/components/live/vehicle-manager";
import { hasPermission } from "@/lib/access-policy";
import { requirePagePermission } from "@/lib/server/page-access";

export default async function Page() {
  const session = await requirePagePermission("fleet.read");
  if (!session) return null;
  return <VehicleManager canWrite={hasPermission(session, "fleet.write")} />;
}
