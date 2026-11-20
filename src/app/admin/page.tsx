import { requirePagePermission } from "@/lib/server/page-access";
import { hasPermission } from "@/lib/access-policy";
import { canManageTrips } from "@/lib/trip-management";
import { Trips } from "@/components/live/trips";
import { OverviewHero } from "@/components/live/overview-hero";

export default async function Page() {
  const session = await requirePagePermission("trip.read");
  if (!session) return null;
  const fullName = session.user.fullName?.trim();
  return (
    <div className="pn-page-stack">
      <OverviewHero
        name={fullName ? fullName.split(/\s+/).pop()! : "bạn"}
        access={{
          payments: hasPermission(session, "payment.read"),
          tripWrite: canManageTrips(
            session,
            process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
          ),
          passengers: hasPermission(session, "booking.read"),
          fleet: hasPermission(session, "fleet.read"),
          routes: hasPermission(session, "route.read"),
        }}
      />
      <Trips overview />
    </div>
  );
}
