"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../modal";
import { PasswordInput } from "../password-input";
import { publishSessionEvent } from "@/lib/session-sync";
import { authPost } from "./auth-client";
import { Notice, StatusBadge } from "./shared";

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setOtp("");
    setError("");
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authPost("mfa/disable", { password, otp });
      publishSessionEvent("login");
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể tắt 2FA.");
      setPassword("");
      setOtp("");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/40 py-3 text-sm">
      <span className="flex items-center gap-2 text-muted">
        <ShieldCheck size={15} aria-hidden="true" />
        Xác thực hai yếu tố
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          tone={enabled ? "success" : "neutral"}
          label={enabled ? "Đã bật" : "Chưa bật"}
        />
        {enabled ? (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            Tắt 2FA
          </button>
        ) : (
          <Link className="btn" href="/mfa">
            Bật 2FA
          </Link>
        )}
      </div>
      {open && (
        <Modal title="Tắt xác thực hai yếu tố" onClose={close}>
          <form className="space-y-4" onSubmit={disable}>
            <p className="text-sm text-muted">
              Sau khi tắt, bạn có thể đăng nhập bằng mật khẩu. Các phiên trên
              thiết bị khác sẽ bị thu hồi.
            </p>
            <div className="pn-form-grid sm:grid-cols-2">
              <div>
                <label htmlFor="disable-mfa-password" className="label">
                  Mật khẩu hiện tại
                </label>
                <PasswordInput
                  id="disable-mfa-password"
                  className="field"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </div>
              <label className="label">
                Mã Authenticator hiện tại
                <input
                  className="field font-mono"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, ""))
                  }
                  disabled={busy}
                />
              </label>
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={close}
                disabled={busy}
              >
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Đang tắt…" : "Xác nhận tắt 2FA"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
