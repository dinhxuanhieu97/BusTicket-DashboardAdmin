import { hasPermission } from "@/lib/access-policy";
import { requirePagePermission } from "@/lib/server/page-access";
import { Payments } from "@/components/live/payments";
import { RefundsPanel } from "@/components/live/refunds";
export default async function Page() {
  const session = await requirePagePermission("payment.read");
  if (!session) return null;
  return (
    <div className="pn-page-stack">
      <RefundsPanel canManage={hasPermission(session, "payment.manage")} />
      <Payments />
    </div>
  );
}
