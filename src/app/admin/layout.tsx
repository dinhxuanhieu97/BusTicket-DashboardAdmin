import { redirect } from "next/navigation";
import { pageAccess } from "@/lib/server/page-access";
import { AccessFailure } from "@/components/live/auth-forms";
import { LiveShell } from "@/components/live/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await pageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return <AccessFailure message={access.message} />;
  }
  if (access.session.scope !== "full") redirect("/mfa");
  return (
    <LiveShell
      user={access.session.user}
      permissions={access.session.permissions}
    >
      {children}
    </LiveShell>
  );
}
