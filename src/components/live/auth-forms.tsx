"use client";
import Link from "next/link";
import { PasswordInput } from "../password-input";

import { useEffect, useState } from "react";
import {
  publishSessionEvent,
  subscribeSessionEvents,
} from "@/lib/session-sync";
import { LockKeyhole, ShieldCheck, LogOut } from "lucide-react";
import { authPost, ClientError } from "./auth-client";
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
    if (data.scope === "full") window.location.replace("/admin");
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
      subtitle="Dành cho tài khoản OWNER · Kết nối dữ liệu thật"
    >
      <form
        className="space-y-5"
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
              result.scope === "mfa_setup" ? "/mfa" : "/admin",
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
        <div>
          <label className="label" htmlFor="phone">
            Số điện thoại
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="username"
            className="field"
            placeholder="Số điện thoại tài khoản"
            maxLength={30}
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Mật khẩu
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className="field"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        {needsOtp && (
          <div>
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
              className="field font-mono tracking-widest"
              autoFocus
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
            />
            <p className="mt-2 text-xs text-muted">
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
              Chỉ chọn trên máy riêng. Không chọn thì phiên chỉ giữ tối đa 12
              giờ.
            </span>
          </span>
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
          >
            {error}
          </p>
        )}
        <button
          disabled={busy}
          type="submit"
          className="btn w-full border-transparent bg-accent text-white"
        >
          <LockKeyhole size={17} />
          {busy
            ? "Đang xác thực…"
            : needsOtp
              ? "Xác thực và đăng nhập"
              : "Đăng nhập"}
        </button>
      </form>
      <p className="mt-5 text-xs leading-relaxed text-muted">
        OWNER được quản lý chuyến khi nhà xe đã mở quyền. Nhân viên, đơn đặt vé
        và thanh toán vẫn chỉ đọc.
      </p>
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
  return (
    <main className="grid min-h-dvh place-items-center p-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-content-center rounded-xl bg-gradient-to-br from-accent to-cyan-400 text-xl font-bold text-white">
            P
          </span>
          <div>
            <strong className="text-xl">PNTicket</strong>
            <p className="text-xs text-muted">Quản trị nhà xe</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 mb-7 text-sm text-muted">{subtitle}</p>
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
        className="btn"
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
        <LogOut size={16} />
        {busy ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
/** `optional`: phiên đã đầy đủ, người dùng tự bật 2FA từ Cài đặt (không bắt buộc). */
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
          ? "Không bắt buộc — thêm một lớp bảo vệ cho tài khoản OWNER."
          : "Tài khoản OWNER cần bật 2FA trước khi xem dữ liệu."
      }
    >
      <p className="mb-5 text-sm leading-relaxed text-muted">
        Dùng ứng dụng Authenticator để quét mã QR, sau đó nhập mã 6 số để xác
        nhận. Mã QR và khóa chỉ hiển thị trong phiên thiết lập này.
      </p>
      {!setup ? (
        <button
          className="btn w-full bg-accent text-white"
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
          <ShieldCheck size={17} />
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
          <div className="flex justify-center">
            <img
              width={240}
              height={240}
              src={setup.qr}
              alt="Mã QR thiết lập Authenticator"
              className="rounded-xl"
            />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">
              Nhập khóa thủ công nếu không quét được QR
            </summary>
            <code className="mt-2 block break-all rounded-lg bg-surface p-3 select-all">
              {setup.secret}
            </code>
          </details>
          <div>
            <label htmlFor="mfa-otp" className="label">
              Mã Authenticator
            </label>
            <input
              id="mfa-otp"
              className="field font-mono tracking-widest"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn w-full bg-accent text-white"
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
        <p
          role="alert"
          className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-400"
        >
          {error}
        </p>
      )}
      <div className="mt-6 border-t border-line pt-4">
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
      <p role="alert" className="mb-5 text-sm text-amber-400">
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
