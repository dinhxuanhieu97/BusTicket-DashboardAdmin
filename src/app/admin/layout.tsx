import { redirect } from "next/navigation";
import { pageAccess } from "@/lib/server/page-access";
import { AccessFailure } from "@/components/live/auth-forms";
import { LiveShell } from "@/components/live/shell";
import { canManageTrips } from "@/lib/trip-management";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await pageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    // Quản trị nền tảng đăng nhập vào khu riêng.
    if (access.code === "OPERATOR_REQUIRED") redirect("/platform");
    return <AccessFailure message={access.message} />;
  }
  if (access.session.scope !== "full") redirect("/mfa");
  if (access.session.mustChangePassword) redirect("/change-password");
  return (
    <LiveShell
      user={access.session.user}
      permissions={access.session.permissions}
      tripWrite={canManageTrips(
        access.session,
        process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
      )}
    >
      {children}
    </LiveShell>
  );
}
