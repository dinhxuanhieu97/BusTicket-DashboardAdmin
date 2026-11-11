import Link from "next/link";
import { StatusBadge } from "@/components/live/shared";
import { GeneralInformation } from "@/components/live/general-information";
import { TwoFactorSettings } from "@/components/live/two-factor-settings";
import { ChangePasswordForm } from "@/components/live/password-forms";
import { canManageTrips } from "@/lib/trip-management";
import { redirect } from "next/navigation";
import { operatorSession } from "@/lib/server/session";
import { ApiError, hasPermission } from "@/lib/access-policy";
import { roleLabels } from "@/lib/live-contracts";
import { AccessFailure } from "@/components/live/auth-forms";
import {
  ShieldCheck,
  User,
  Phone,
  KeyRound,
  Building,
  Info,
} from "lucide-react";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  let access;
  try {
    access = await operatorSession();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
    if (e instanceof ApiError && e.code === "MFA_SETUP_REQUIRED")
      redirect("/mfa");
    return <AccessFailure message="Không đọc được thông tin tài khoản." />;
  }
  const { tab } = await searchParams;
  const canReadGeneral = hasPermission(access.session, "policy.write");
  const showGeneral = canReadGeneral && tab === "general";
  const user = access.session.user;
  const initial = user.fullName
    ? user.fullName.trim().charAt(0).toUpperCase()
    : "O";

  const account = (
    <div className="max-w-3xl">
      <section className="card overflow-hidden">
        <header className="border-b border-line pn-panel-inset">
          <div className="flex flex-wrap items-center gap-4">
            <div className="pn-avatar size-12 text-lg" aria-hidden="true">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="wrap-anywhere text-lg font-semibold tracking-tight">
                  {user.fullName || "Tài khoản PNTicket"}
                </h2>
                <StatusBadge
                  tone="success"
                  label="Đã xác minh"
                  icon={ShieldCheck}
                />
              </div>
              <p className="mt-0.5 font-mono text-sm text-muted">
                {user.phone}
              </p>
            </div>
          </div>
        </header>

        <div className="pn-panel-inset">
          <h3 className="text-base font-semibold">
            Thông tin tài khoản & quyền hạn
          </h3>
          <dl className="mt-4 divide-y divide-line/40">
            {[
              ["Số điện thoại", user.phone, Phone],
              ["Vai trò", roleLabels[user.role], User],
              ["Phạm vi", "Dữ liệu nhà xe thuộc tài khoản", Building],
              [
                "Quản lý chuyến",
                canManageTrips(
                  access.session,
                  process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
                )
                  ? "Được phép"
                  : "Không có quyền chỉnh sửa",
                KeyRound,
              ],
            ].map(([label, value, Icon]) => (
              <div
                key={label as string}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <dt className="flex items-center gap-2 text-muted">
                  <Icon
                    size={15}
                    className="text-muted/70"
                    aria-hidden="true"
                  />
                  <span>{label as string}</span>
                </dt>
                <dd className="font-medium text-ink">{value as string}</dd>
              </div>
            ))}
          </dl>
          <TwoFactorSettings enabled={user.mfaEnabled} />

          <section
            aria-labelledby="change-password-heading"
            className="mt-4 rounded-xl border border-line/60 bg-surface/20 p-4"
          >
            <h3
              id="change-password-heading"
              className="mb-3 text-base font-semibold"
            >
              Đổi mật khẩu
            </h3>
            <ChangePasswordForm />
          </section>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line/60 bg-surface/30 p-4 text-xs leading-relaxed text-muted">
            <Info
              size={16}
              className="mt-0.5 shrink-0 text-muted"
              aria-hidden="true"
            />
            <p>Đăng xuất kết thúc phiên trên trình duyệt này.</p>
          </div>
        </div>
      </section>
    </div>
  );
  return (
    <div className="pn-page-stack">
      <nav
        aria-label="Mục cài đặt"
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        <Link
          className="pn-tab"
          href="/admin/settings"
          aria-current={showGeneral ? undefined : "page"}
        >
          Tài khoản
        </Link>
        {canReadGeneral && (
          <Link
            className="pn-tab"
            href="/admin/settings?tab=general"
            aria-current={showGeneral ? "page" : undefined}
          >
            Thông tin chung
          </Link>
        )}
      </nav>
      {showGeneral ? (
        <GeneralInformation
          mfaEnabled={user.mfaEnabled}
          canConfigurePayments={
            access.session.permissions?.includes("payment.configure") ?? true
          }
        />
      ) : (
        account
      )}
    </div>
  );
}
