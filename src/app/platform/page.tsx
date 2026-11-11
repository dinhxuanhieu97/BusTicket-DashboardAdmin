import { redirect } from "next/navigation";
import { PlatformConsole } from "@/components/live/platform-console";
import { platformPageAccess } from "@/lib/server/page-access";
export const dynamic = "force-dynamic";
export default async function Page() {
  const access = await platformPageAccess();
  if (!access.ok) redirect("/login");
  return <PlatformConsole user={access.session.user} />;
}
