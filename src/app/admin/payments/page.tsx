import { requirePagePermission } from "@/lib/server/page-access";
import { Payments } from "@/components/live/payments";
export default async function Page() {
  if (!(await requirePagePermission("payment.read"))) return null;
  return <Payments />;
}
