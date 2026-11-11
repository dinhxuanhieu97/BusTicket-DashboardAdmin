import { redirect } from "next/navigation";
import { AccessFailure } from "@/components/live/auth-forms";
import { Staff } from "@/components/live/users";
import { ApiError } from "@/lib/access-policy";
import { staffAccess } from "@/app/api/staff/access";

export default async function Page() {
  try {
    const { viewerId } = await staffAccess();
    return <Staff viewerId={viewerId} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    if (error instanceof ApiError && error.code === "MFA_SETUP_REQUIRED")
      redirect("/mfa");
    return (
      <AccessFailure
        message={
          error instanceof ApiError
            ? error.message
            : "Không đọc được thông tin tài khoản."
        }
      />
    );
  }
}
