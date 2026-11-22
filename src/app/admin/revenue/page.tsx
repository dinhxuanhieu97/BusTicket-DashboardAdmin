import { Revenue } from "@/components/live/revenue";
import { requirePagePermission } from "@/lib/server/page-access";

export default async function Page() {
  const session = await requirePagePermission("payment.read");
  if (!session) return null;
  return <Revenue />;
}
