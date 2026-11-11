"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { PasswordInput } from "../password-input";
import { publishSessionEvent } from "@/lib/session-sync";
import { authPost } from "./auth-client";

/** Bật/tắt xác thực hai yếu tố trong Cài đặt → Tài khoản. 2FA không bắt buộc, trừ khi API bật `AUTH_REQUIRE_MFA`. */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!enabled)
    return (
      <section className="card max-w-2xl p-6">
        <h2 className="text-lg font-bold">Xác thực hai yếu tố</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Chưa bật. Không bắt buộc, nhưng nên bật vì tài khoản OWNER đổi được
          tài khoản nhận tiền và xác nhận thanh toán.
        </p>
        <Link className="btn mt-4 bg-accent text-white" href="/mfa">
          <ShieldCheck size={17} />
          Bật 2FA
        </Link>
      </section>
    );
  return (
    <section className="card max-w-2xl p-6">
      <h2 className="text-lg font-bold">Xác thực hai yếu tố</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Đang bật. Tắt 2FA thì đăng nhập chỉ cần mật khẩu; các phiên đăng nhập
        khác sẽ bị đăng xuất.
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await authPost("mfa/disable", { password, otp });
            publishSessionEvent("login");
            window.location.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tắt 2FA.");
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="disable-mfa-password" className="label">
            Mật khẩu hiện tại
          </label>
          <PasswordInput
            id="disable-mfa-password"
            className="field"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="disable-mfa-otp" className="label">
            Mã Authenticator hiện tại
          </label>
          <input
            id="disable-mfa-otp"
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
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-400"
          >
            {error}
          </p>
        )}
        <button type="submit" className="btn" disabled={busy}>
          <ShieldOff size={17} />
          {busy ? "Đang tắt…" : "Tắt 2FA"}
        </button>
      </form>
    </section>
  );
}
