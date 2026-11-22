import { RouteManager } from "@/components/live/route-manager";
import { hasPermission } from "@/lib/access-policy";
import { requirePagePermission } from "@/lib/server/page-access";

export default async function Page() {
  const session = await requirePagePermission("route.read");
  if (!session) return null;
  return <RouteManager canWrite={hasPermission(session, "route.write")} />;
}
