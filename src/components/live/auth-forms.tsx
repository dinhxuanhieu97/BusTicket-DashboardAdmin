"use client";
import { PasswordInput } from "../password-input";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  publishSessionEvent,
  subscribeSessionEvents,
} from "@/lib/session-sync";
import { LockKeyhole, ShieldCheck, LogOut, CheckCircle2 } from "lucide-react";
import { authPost, ClientError } from "./auth-client";
import { BrandMark, useBrand } from "./brand";

/**
 * Hỏi máy chủ phiên hiện tại rồi chuyển trang nếu cần. Không tin dữ liệu nào khác ngoài `/api/auth/session`.
 */
async function followServerSession(where: "login" | "mfa") {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (res.status === 401) {
      if (where === "mfa") window.location.replace("/login");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (data.scope === "full" && (where === "login" || data.user?.mfaEnabled))
      window.location.replace("/admin");
    else if (where === "login") window.location.replace("/mfa");
  } catch {}
}
/** Trang đăng nhập/2FA: khi tab khác vừa đăng nhập hoặc đăng xuất, hỏi lại máy chủ rồi chuyển trang. */
function useFollowSessionFromOtherTabs(where: "login" | "mfa") {
  useEffect(
    () => subscribeSessionEvents(() => followServerSession(where)),
    [where],
  );
}
/**
 * Mở `/login` từ link ở trang khác (Zalo, email): cookie SameSite=Strict không đi kèm điều hướng đó nên proxy không
 * thấy phiên. Request `fetch` cùng origin từ trang này thì có cookie — hỏi lại một lần để phiên "Ghi nhớ đăng nhập"
 * còn hạn vào thẳng trang quản trị thay vì bắt đăng nhập lại (và tạo thêm phiên).
 */
function useResumeExistingSession() {
  useEffect(() => {
    void followServerSession("login");
  }, []);
}

export function LoginForm() {
  useFollowSessionFromOtherTabs("login");
  useResumeExistingSession();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <AuthFrame
      title="Đăng nhập quản trị"
      subtitle="Dành cho chủ nhà xe và nhân viên"
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await authPost("login", {
              phone,
              password,
              ...(otp ? { otp } : {}),
              ...(remember ? { rememberMe: true } : {}),
            });
            setPassword("");
            setOtp("");
            publishSessionEvent(result.scope === "mfa_setup" ? "mfa" : "login");
            window.location.assign(
              result.scope === "mfa_setup"
                ? "/mfa"
                : result.mustChangePassword
                  ? "/change-password"
                  : "/admin",
            );
          } catch (err) {
            if (err instanceof ClientError && err.code === "MFA_REQUIRED") {
              setNeedsOtp(true);
              setError("Nhập mã 6 số từ ứng dụng Authenticator để tiếp tục.");
            } else
              setError(
                err instanceof Error ? err.message : "Không thể đăng nhập.",
              );
            setBusy(false);
          }
        }}
      >
        <div className="pn-field-group">
          <label className="label" htmlFor="phone">
            Số điện thoại
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="username"
            className="field font-medium"
            placeholder="Số điện thoại tài khoản"
            maxLength={30}
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="pn-field-group">
          <div className="flex items-center justify-between gap-2">
            <label className="label" htmlFor="password">
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className="field font-medium"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        {needsOtp && (
          <div className="pn-field-group rounded-xl border border-accent/30 bg-accent/10 p-4">
            <label className="label" htmlFor="otp">
              Mã Authenticator
            </label>
            <input
              id="otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              className="field font-mono text-center text-lg tracking-widest font-bold"
              autoFocus
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              placeholder="••••••"
            />
            <p className="text-xs text-muted">
              Mã thay đổi định kỳ trong ứng dụng xác thực của bạn.
            </p>
          </div>
        )}
        <label className="flex items-start gap-2.5 text-sm" htmlFor="remember">
          <input
            id="remember"
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent,currentColor)]"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={busy}
          />
          <span>
            Ghi nhớ đăng nhập 30 ngày
            <span className="block text-xs text-muted">
              Chỉ bật trên thiết bị cá nhân.
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="pn-tone pn-notice" data-tone="danger">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          type="submit"
          className="btn btn-primary w-full py-2.5 text-sm"
        >
          <LockKeyhole size={17} aria-hidden="true" />
          {busy
            ? "Đang xác thực…"
            : needsOtp
              ? "Xác thực và đăng nhập"
              : "Đăng nhập"}
        </button>
      </form>
    </AuthFrame>
  );
}

export function AuthFrame({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  // Chưa cấu hình nhà xe cho bản dashboard này → ẩn khối thương hiệu.
  const brand = useBrand();
  return (
    <main className="pn-page-inline grid min-h-dvh place-items-center py-6 sm:py-10">
      <section className="card pn-auth pn-panel-inset w-full max-w-md">
        {brand && (
          <div
            className="mb-5 flex items-center gap-3 sm:mb-6"
            data-testid="auth-brand"
          >
            <BrandMark name={brand.name} logoUrl={brand.logoUrl} />
            <div className="min-w-0">
              <strong className="block text-xl font-bold tracking-tight text-ink wrap-anywhere">
                {brand.name}
              </strong>
              <p className="text-xs text-muted">Quản trị nhà xe</p>
            </div>
          </div>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 mb-4 text-sm text-muted sm:mb-6">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div>
      <button
        className="btn btn-ghost w-full justify-start text-muted"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await authPost("logout");
            publishSessionEvent("logout");
            window.location.assign("/login");
          } catch {
            setError("Chưa đăng xuất được. Vui lòng thử lại.");
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} aria-hidden="true" />
        <span>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</span>
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function MfaForm({ optional = false }: { optional?: boolean }) {
  useFollowSessionFromOtherTabs("mfa");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(
    null,
  );
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <AuthFrame
      title="Thiết lập xác thực hai yếu tố"
      subtitle={
        optional
          ? "Bật thêm xác thực cho tài khoản của bạn."
          : "Tài khoản của bạn cần bật 2FA trước khi xem dữ liệu."
      }
    >
      <p className="mb-5 text-sm leading-relaxed text-muted">
        Dùng ứng dụng Authenticator để quét mã QR, sau đó nhập mã 6 số để xác
        nhận. Mã QR và khóa chỉ hiển thị trong phiên thiết lập này.
      </p>
      {!setup ? (
        <button
          className="btn btn-primary w-full py-2.5 text-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setSetup(await authPost("mfa/setup"));
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Không thể bắt đầu thiết lập.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <ShieldCheck size={17} aria-hidden="true" />
          {busy ? "Đang tạo mã…" : "Bắt đầu thiết lập 2FA"}
        </button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await authPost("mfa/confirm", { otp });
              publishSessionEvent("login");
              setSetup(null);
              setOtp("");
              window.location.assign(optional ? "/admin/settings" : "/admin");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Không thể xác nhận.",
              );
              setBusy(false);
            }
          }}
        >
          <div className="flex justify-center p-3 rounded-2xl bg-white border border-line">
            <img
              width={240}
              height={240}
              src={setup.qr}
              alt="Mã QR thiết lập Authenticator"
              className="rounded-xl"
            />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
              Nhập khóa thủ công nếu không quét được QR
            </summary>
            <code className="mt-2 block break-all rounded-xl border border-line/60 bg-surface p-3 font-mono text-xs select-all">
              {setup.secret}
            </code>
          </details>
          <div className="pn-field-group">
            <label htmlFor="mfa-otp" className="label">
              Mã Authenticator
            </label>
            <input
              id="mfa-otp"
              className="field font-mono text-center text-lg tracking-widest font-bold"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              placeholder="••••••"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full py-2.5 text-sm"
          >
            {busy
              ? "Đang xác nhận…"
              : optional
                ? "Xác nhận và bật 2FA"
                : "Xác nhận và vào quản trị"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="pn-tone pn-notice mt-4" data-tone="danger">
          {error}
        </p>
      )}
      <div className="mt-6 border-t border-line/60 pt-4">
        {optional ? (
          <Link className="btn w-full" href="/admin/settings">
            Để sau, quay lại Cài đặt
          </Link>
        ) : (
          <LogoutButton />
        )}
      </div>
    </AuthFrame>
  );
}

export function AccessFailure({ message }: { message: string }) {
  return (
    <AuthFrame
      title="Chưa thể mở dữ liệu"
      subtitle="PNTicket giữ nguyên chế độ dữ liệu thật."
    >
      <p role="alert" className="pn-tone pn-notice mb-5" data-tone="warning">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={() => window.location.reload()}>
          Thử lại
        </button>
        <LogoutButton />
      </div>
    </AuthFrame>
  );
}
