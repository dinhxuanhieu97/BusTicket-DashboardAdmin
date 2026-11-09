import { redirect } from "next/navigation";
import { pageAccess } from "@/lib/server/page-access";
import { MfaForm, AccessFailure } from "@/components/live/auth-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  const access = await pageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return <AccessFailure message={access.message} />;
  }
  if (access.session.scope === "full" && access.session.user.mfaEnabled)
    redirect("/admin");
  return <MfaForm />;
}
