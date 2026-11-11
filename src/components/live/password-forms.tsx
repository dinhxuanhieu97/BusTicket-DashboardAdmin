"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";
import { PasswordInput } from "../password-input";
import { publishSessionEvent } from "@/lib/session-sync";
import { authPost } from "./auth-client";
import { AuthFrame, LogoutButton } from "./auth-forms";
import { Notice } from "./shared";

const MIN = 10;

function PasswordPair({
  value,
  confirm,
  onValue,
  onConfirm,
  disabled,
}: {
  value: string;
  confirm: string;
  onValue: (v: string) => void;
  onConfirm: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="pn-field-group">
        <label className="label" htmlFor="new-password">
          Mật khẩu mới
        </label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          className="field font-medium"
          required
          minLength={MIN}
          maxLength={128}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          disabled={disabled}
        />
        <p className="text-xs text-muted">Tối thiểu {MIN} ký tự.</p>
      </div>
      <div className="pn-field-group">
        <label className="label" htmlFor="confirm-password">
          Nhập lại mật khẩu mới
        </label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          className="field font-medium"
          required
          minLength={MIN}
          maxLength={128}
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          disabled={disabled}
        />
      </div>
    </>
  );
}

function mismatch(next: string, confirm: string) {
  if (next.length < MIN) return `Mật khẩu mới tối thiểu ${MIN} ký tự.`;
  if (next !== confirm) return "Hai lần nhập mật khẩu mới không khớp.";
  return "";
}

/** Đổi mật khẩu khi biết mật khẩu hiện tại. `forced`: mật khẩu tạm do OWNER đặt, đổi xong mới vào dashboard. */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = mismatch(next, confirm);
    if (problem) return setError(problem);
    if (next === current)
      return setError("Mật khẩu mới phải khác mật khẩu hiện tại.");
    setBusy(true);
    setError("");
    try {
      await authPost("password", {
        currentPassword: current,
        newPassword: next,
      });
      publishSessionEvent("login");
      setCurrent("");
      setNext("");
      setConfirm("");
      if (forced) return window.location.replace("/admin");
      setDone(true);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mật khẩu.");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit} aria-label="Đổi mật khẩu">
      <div className="pn-field-group">
        <label className="label" htmlFor="current-password">
          {forced ? "Mật khẩu tạm" : "Mật khẩu hiện tại"}
        </label>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          className="field font-medium"
          required
          maxLength={128}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={busy}
        />
      </div>
      <PasswordPair
        value={next}
        confirm={confirm}
        onValue={setNext}
        onConfirm={setConfirm}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="pn-tone pn-notice" data-tone="danger">
          {error}
        </p>
      )}
      {done && (
        <Notice tone="success">
          Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.
        </Notice>
      )}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary w-full py-2.5 text-sm sm:w-auto"
      >
        <KeyRound size={16} aria-hidden="true" />
        {busy ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}

/** Trang bắt buộc đổi mật khẩu tạm. */
export function ForcedPasswordChange() {
  return (
    <AuthFrame
      title="Đổi mật khẩu"
      subtitle="Chủ nhà xe vừa đặt mật khẩu tạm cho bạn"
    >
      <p className="mb-4 text-sm text-muted">
        Vì an toàn, hãy đặt mật khẩu riêng trước khi tiếp tục. Mật khẩu tạm sẽ
        không dùng được nữa.
      </p>
      <ChangePasswordForm forced />
      <div className="mt-4 border-t border-line/60 pt-4">
        <LogoutButton />
      </div>
    </AuthFrame>
  );
}

/** Quên mật khẩu: tự đặt lại bằng mã Authenticator, hoặc hướng dẫn nhờ chủ nhà xe. */
export function ForgotPasswordForm() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = mismatch(next, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await authPost("password/reset", { phone, otp, newPassword: next });
      setDone(true);
      setOtp("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không đặt lại được mật khẩu.",
      );
      setOtp("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Quên mật khẩu"
      subtitle="Lấy lại quyền truy cập tài khoản"
    >
      <div className="mb-5 space-y-2 rounded-xl border border-line/60 bg-surface/30 p-4 text-sm text-muted">
        <p>
          <strong className="text-ink">Nhân viên:</strong> nhờ chủ nhà xe vào
          mục Nhân viên đặt mật khẩu tạm. Bạn sẽ đổi sang mật khẩu riêng ở lần
          đăng nhập tiếp theo.
        </p>
        <p>
          <strong className="text-ink">Tài khoản đã bật 2FA:</strong> tự đặt lại
          bên dưới bằng mã trong ứng dụng Authenticator.
        </p>
        <p>
          <strong className="text-ink">Chủ nhà xe chưa bật 2FA:</strong> liên hệ
          quản trị nền tảng PNTicket để xác minh và đặt lại.
        </p>
      </div>
      {done ? (
        <div className="space-y-4">
          <Notice tone="success">
            Đã đặt lại mật khẩu. Mọi phiên đăng nhập cũ đã kết thúc.
          </Notice>
          <Link href="/login" className="btn btn-primary w-full py-2.5 text-sm">
            <LockKeyhole size={16} aria-hidden="true" /> Đăng nhập
          </Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={submit}
          aria-label="Đặt lại mật khẩu bằng 2FA"
        >
          <div className="pn-field-group">
            <label className="label" htmlFor="reset-phone">
              Số điện thoại
            </label>
            <input
              id="reset-phone"
              type="tel"
              autoComplete="username"
              className="field font-medium"
              required
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="pn-field-group">
            <label className="label" htmlFor="reset-otp">
              Mã Authenticator
            </label>
            <input
              id="reset-otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              className="field font-mono text-center text-lg font-bold tracking-widest"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              placeholder="••••••"
            />
          </div>
          <PasswordPair
            value={next}
            confirm={confirm}
            onValue={setNext}
            onConfirm={setConfirm}
            disabled={busy}
          />
          {error && (
            <p role="alert" className="pn-tone pn-notice" data-tone="danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full py-2.5 text-sm"
          >
            <KeyRound size={16} aria-hidden="true" />
            {busy ? "Đang xác thực…" : "Đặt lại mật khẩu"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link
          href="/login"
          className="text-accent underline-offset-2 hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthFrame>
  );
}
