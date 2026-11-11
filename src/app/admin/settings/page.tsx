import Link from "next/link";
import { GeneralInformation } from "@/components/live/general-information";
import { TwoFactorSettings } from "@/components/live/two-factor-settings";
import { canManageTrips } from "@/lib/trip-management";
import { redirect } from "next/navigation";
import { ownerSession } from "@/lib/server/session";
import { ApiError } from "@/lib/access-policy";
import { AccessFailure } from "@/components/live/auth-forms";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  let access;
  try {
    access = await ownerSession();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
    if (e instanceof ApiError && e.code === "MFA_SETUP_REQUIRED")
      redirect("/mfa");
    return <AccessFailure message="Không đọc được thông tin tài khoản." />;
  }
  const { tab } = await searchParams;
  const canReadGeneral =
    access.session.permissions?.includes("policy.read") ?? true;
  const showGeneral = canReadGeneral && tab === "general";
  const user = access.session.user;
  const account = (
    <section className="card max-w-2xl p-6">
      <h2 className="text-lg font-bold">Tài khoản PNTicket</h2>
      <dl className="mt-5 divide-y divide-line">
        {[
          ["Số điện thoại", user.phone],
          ["Vai trò", "OWNER · Chủ nhà xe"],
          ["Xác thực hai yếu tố", user.mfaEnabled ? "Đã bật" : "Chưa bật"],
          ["Phạm vi", "Dữ liệu nhà xe thuộc tài khoản"],
          [
            "Chế độ",
            canManageTrips(
              access.session,
              process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
            )
              ? "Được quản lý chuyến"
              : "Chỉ đọc",
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-4 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        Đăng xuất kết thúc phiên trên trình duyệt này.
      </p>
    </section>
  );
  return (
    <div className="space-y-6">
      <nav aria-label="Mục cài đặt" className="flex flex-wrap gap-2">
        <Link
          className={`btn ${showGeneral ? "" : "btn-primary"}`}
          href="/admin/settings"
          aria-current={showGeneral ? undefined : "page"}
        >
          Tài khoản
        </Link>
        {canReadGeneral && (
          <Link
            className={`btn ${showGeneral ? "btn-primary" : ""}`}
            href="/admin/settings?tab=general"
            aria-current={showGeneral ? "page" : undefined}
          >
            Thông tin chung
          </Link>
        )}
      </nav>
      {showGeneral ? (
        <GeneralInformation
          canConfigurePayments={
            access.session.permissions?.includes("payment.configure") ?? true
          }
        />
      ) : (
        <>
          {account}
          <TwoFactorSettings enabled={user.mfaEnabled} />
        </>
      )}
    </div>
  );
}
