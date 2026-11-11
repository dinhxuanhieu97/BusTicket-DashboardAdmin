import { redirect } from "next/navigation";
import { AccessFailure } from "@/components/live/auth-forms";
import { platformPageAccess } from "@/lib/server/page-access";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await platformPageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    if (access.code === "PLATFORM_REQUIRED") redirect("/admin");
    if (access.code === "MFA_SETUP_REQUIRED") redirect("/mfa");
    return <AccessFailure message={access.message} />;
  }
  if (access.session.scope !== "full") redirect("/mfa");
  if (access.session.mustChangePassword) redirect("/change-password");
  return children;
}
