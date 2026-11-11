import { BrandProvider } from "@/components/live/brand";
import { loadBrand } from "@/lib/server/brand";
import { redirect } from "next/navigation";
import { homeFor, userPageAccess } from "@/lib/server/page-access";
import { MfaForm, AccessFailure } from "@/components/live/auth-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  const access = await userPageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return <AccessFailure message={access.message} />;
  }
  if (access.session.scope === "full" && access.session.user.mfaEnabled)
    redirect(homeFor(access.session.user.role));
  return (
    <BrandProvider brand={await loadBrand()}>
      <MfaForm optional={access.session.scope === "full"} />
    </BrandProvider>
  );
}
