import { BrandProvider } from "@/components/live/brand";
import { loadBrand } from "@/lib/server/brand";
import { ForgotPasswordForm } from "@/components/live/password-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <BrandProvider brand={await loadBrand()}>
      <ForgotPasswordForm />
    </BrandProvider>
  );
}
