import { BrandProvider } from "@/components/live/brand";
import { loadBrand } from "@/lib/server/brand";
import { LoginForm } from "@/components/live/auth-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <BrandProvider brand={await loadBrand()}>
      <LoginForm />
    </BrandProvider>
  );
}
