import { Passengers } from "@/components/live/passengers";
import { hasPermission } from "@/lib/access-policy";
import { requirePagePermission } from "@/lib/server/page-access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const session = await requirePagePermission("booking.read");
  if (!session) return null;
  return (
    <Passengers
      canExport={hasPermission(session, "booking.export")}
      canCreate={hasPermission(session, "booking.create")}
      initialDate={typeof query.date === "string" ? query.date : undefined}
      initialTripId={
        typeof query.trip === "string" && UUID.test(query.trip)
          ? query.trip
          : undefined
      }
    />
  );
}
