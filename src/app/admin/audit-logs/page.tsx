import { requirePagePermission } from "@/lib/server/page-access";
import { Audit } from "@/components/live/audit";
export default async function Page() {
  if (!(await requirePagePermission("audit.read"))) return null;
  return <Audit />;
}
