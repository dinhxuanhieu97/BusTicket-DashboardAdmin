import { requirePagePermission } from "@/lib/server/page-access";
import { hasPermission } from "@/lib/access-policy";
import { Payments } from "@/components/live/payments";
import { RefundsPanel } from "@/components/live/refunds";
export default async function Page() {
  const session = await requirePagePermission("payment.read");
  if (!session) return null;
  return (
    <Payments
      canReinstate={
        hasPermission(session, "payment.manage") &&
        hasPermission(session, "trip.read")
      }
      afterHero={
        <RefundsPanel canManage={hasPermission(session, "payment.manage")} />
      }
    />
  );
}
