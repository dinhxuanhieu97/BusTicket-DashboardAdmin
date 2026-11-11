import { BrandProvider } from "@/components/live/brand";
import { loadBrand } from "@/lib/server/brand";
import { redirect } from "next/navigation";
import { ForcedPasswordChange } from "@/components/live/password-forms";
import { userPageAccess } from "@/lib/server/page-access";
export const dynamic = "force-dynamic";
export default async function Page() {
  const access = await userPageAccess();
  if (!access.ok) redirect("/login");
  if (access.session.scope !== "full") redirect("/mfa");
  if (!access.session.mustChangePassword)
    redirect(
      access.session.user.role === "PLATFORM_ADMIN"
        ? "/platform"
        : "/admin/settings",
    );
  return (
    <BrandProvider brand={await loadBrand()}>
      <ForcedPasswordChange />
    </BrandProvider>
  );
}
