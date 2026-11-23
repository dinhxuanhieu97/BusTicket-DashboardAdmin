"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MailCheck, Send } from "lucide-react";
import {
  parseRecipients,
  presetFor,
  SMTP_PRESETS,
  type AlertSettings,
  type SmtpPresetId,
} from "@/lib/alert-settings";
import { vnDateTime } from "@/lib/live-contracts";
import { operation } from "./operations-client";
import { Notice, StatusBadge } from "./shared";

const resource = "alert-settings";

/**
 * Tab "Thông báo email" (QS03): chủ xe nhập tài khoản gửi mail (Gmail + mật khẩu ứng dụng…), danh sách nhận và loại
 * sự kiện. Mật khẩu SMTP chỉ gửi đi, không bao giờ đọc lại; lưu cần mật khẩu đăng nhập (+ mã Authenticator).
 */
export function AlertSettingsPanel({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [data, setData] = useState<AlertSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [preset, setPreset] = useState<SmtpPresetId>("gmail");

  async function load() {
    setError("");
    try {
      const d = await operation<AlertSettings>(resource);
      setData(d);
      setPreset(presetFor(d.smtpHost));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const chosen = SMTP_PRESETS.find((p) => p.id === preset);
    const smtpPassword = String(f.get("smtpPassword") ?? "");
    const otp = String(f.get("otp") ?? "");
    const recipients = parseRecipients(String(f.get("recipients") ?? ""));
    setError("");
    setNotice("");
    if (recipients.length === 0 || recipients.length > 5) {
      setError("Nhập từ 1 đến 5 email nhận.");
      return;
    }
    setBusy("save");
    try {
      const saved = await operation<AlertSettings>(resource, "PUT", {
        enabled: f.get("enabled") === "on",
        smtpHost: chosen?.host ?? String(f.get("smtpHost") ?? "").trim(),
        smtpPort: chosen?.port ?? Number(f.get("smtpPort")),
        smtpUser: String(f.get("smtpUser") ?? "").trim(),
        ...(smtpPassword ? { smtpPassword } : {}),
        fromName: String(f.get("fromName") ?? "").trim() || null,
        recipients,
        onPaymentProof: f.get("onPaymentProof") === "on",
        onBookingHeld: f.get("onBookingHeld") === "on",
        password: String(f.get("password") ?? ""),
        ...(otp ? { otp } : {}),
      });
      setData(saved);
      setNotice(
        saved.enabled
          ? "Đã lưu. Bấm “Gửi thư thử” để kiểm tra hộp mail nhận."
          : "Đã lưu. Email báo đang tắt.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      for (const name of ["password", "otp", "smtpPassword"]) {
        const c = form.elements.namedItem(name);
        if (c instanceof HTMLInputElement) c.value = "";
      }
      setBusy(null);
    }
  }

  async function sendTest() {
    setError("");
    setNotice("");
    setBusy("test");
    try {
      const r = await operation<{ sentTo: string[] }>(
        `${resource}/test`,
        "POST",
        {},
      );
      setNotice(`Đã gửi thư thử tới ${r.sentTo.join(", ")}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      void operation<AlertSettings>(resource)
        .then(setData)
        .catch(() => undefined);
    }
  }

  return (
    <section
      className="card space-y-4 pn-panel-inset"
      aria-labelledby="alert-settings-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="alert-settings-title" className="text-base font-semibold">
          Thông báo email
        </h2>
        {data && (
          <StatusBadge
            tone={
              !data.configured
                ? "neutral"
                : data.enabled
                  ? "success"
                  : "warning"
            }
            label={
              !data.configured
                ? "Chưa cấu hình"
                : data.enabled
                  ? "Đang bật"
                  : "Đang tắt"
            }
          />
        )}
      </div>
      <p className="max-w-2xl text-sm text-muted">
        Gửi email cho nhà xe khi khách gửi ảnh chuyển khoản hoặc đặt vé mới trên
        Mini App. Thư ghi mã vé, chuyến, số tiền và link mở thẳng đơn; số điện
        thoại khách được che bớt.
      </p>
      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {data?.lastError && (
        <Notice tone="warning">
          Lần gửi gần nhất bị lỗi
          {data.lastErrorAt ? ` (${vnDateTime(data.lastErrorAt)})` : ""}:{" "}
          {data.lastError}
        </Notice>
      )}
      {data?.lastSentAt && !data.lastError && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <MailCheck size={16} aria-hidden="true" /> Gửi thành công gần nhất:{" "}
          {vnDateTime(data.lastSentAt)}
        </p>
      )}
      {!data ? (
        error ? (
          <button type="button" className="btn" onClick={() => void load()}>
            Tải lại
          </button>
        ) : (
          <p role="status">Đang tải cấu hình email…</p>
        )
      ) : (
        <form key={JSON.stringify(data)} onSubmit={save}>
          <fieldset disabled={busy !== null} className="max-w-2xl space-y-5">
            <fieldset className="space-y-4">
              <legend className="mb-2 text-sm font-semibold">
                Tài khoản gửi mail
              </legend>
              <div className="pn-form-grid sm:grid-cols-2">
                <label className="label">
                  Nhà cung cấp
                  <select
                    className="field"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as SmtpPresetId)}
                  >
                    {SMTP_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                    <option value="custom">Máy chủ khác (SMTP)</option>
                  </select>
                </label>
                <label className="label">
                  Email gửi
                  <input
                    name="smtpUser"
                    type="email"
                    autoComplete="off"
                    className="field"
                    defaultValue={data.smtpUser}
                    placeholder="nhaxe@gmail.com"
                    required
                    maxLength={254}
                  />
                </label>
              </div>
              {preset === "custom" && (
                <div className="pn-form-grid sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <label className="label">
                    Máy chủ SMTP
                    <input
                      name="smtpHost"
                      className="field"
                      defaultValue={
                        presetFor(data.smtpHost) === "custom"
                          ? data.smtpHost
                          : ""
                      }
                      placeholder="mail.tenmien.vn"
                      required
                      maxLength={253}
                    />
                  </label>
                  <label className="label">
                    Cổng
                    <select
                      name="smtpPort"
                      className="field"
                      defaultValue={String(data.smtpPort)}
                    >
                      <option value="465">465 (SSL)</option>
                      <option value="587">587 (STARTTLS)</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="pn-form-grid sm:grid-cols-2">
                <label className="label">
                  {preset === "gmail" ? "Mật khẩu ứng dụng" : "Mật khẩu email"}
                  <input
                    name="smtpPassword"
                    type="password"
                    autoComplete="new-password"
                    className="field"
                    placeholder={
                      data.passwordSet
                        ? "Đã lưu — để trống nếu không đổi"
                        : undefined
                    }
                    required={!data.passwordSet}
                    maxLength={200}
                  />
                </label>
                <label className="label">
                  Tên người gửi (tùy chọn)
                  <input
                    name="fromName"
                    className="field"
                    defaultValue={data.fromName ?? ""}
                    placeholder="Nhà xe Phong Nhung"
                    maxLength={80}
                  />
                </label>
              </div>
              {preset === "gmail" && (
                <p className="text-xs leading-relaxed text-muted">
                  Gmail không cho dùng mật khẩu đăng nhập thường. Bật Xác minh 2
                  bước cho tài khoản Google, rồi tạo{" "}
                  <a
                    className="underline"
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    mật khẩu ứng dụng
                  </a>{" "}
                  (16 ký tự) và dán vào đây. Nên dùng một tài khoản Gmail riêng
                  cho việc gửi thư báo.
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-2 text-sm font-semibold">
                Gửi tới và khi nào
              </legend>
              <label className="label">
                Email nhận (tối đa 5, mỗi dòng một địa chỉ)
                <textarea
                  name="recipients"
                  className="field min-h-20"
                  defaultValue={data.recipients.join("\n")}
                  placeholder={"dieuhanh@nhaxe.vn\nketoan@nhaxe.vn"}
                  required
                  maxLength={1300}
                />
              </label>
              <div className="space-y-2 text-sm">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="onPaymentProof"
                    defaultChecked={data.onPaymentProof}
                    className="mt-0.5"
                  />
                  <span>Khách gửi ảnh chuyển khoản</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="onBookingHeld"
                    defaultChecked={data.onBookingHeld}
                    className="mt-0.5"
                  />
                  <span>
                    Khách đặt vé mới trên Mini App
                    <span className="block text-xs text-muted">
                      Mỗi đơn một thư; ngày đông có thể nhiều thư.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 pt-1 font-medium">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={data.configured ? data.enabled : true}
                    className="mt-0.5"
                  />
                  <span>Bật gửi email</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-semibold">
                Xác nhận để lưu
              </legend>
              <div className="pn-form-grid sm:grid-cols-2">
                <label className="label">
                  Mật khẩu đăng nhập Dashboard
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className="field"
                    required
                    maxLength={128}
                  />
                </label>
                {mfaEnabled && (
                  <label className="label">
                    Mã Authenticator
                    <input
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="field"
                      required
                      pattern="[0-9]{6}"
                      maxLength={6}
                    />
                  </label>
                )}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2 max-sm:flex-col">
              <button className="btn btn-primary" type="submit">
                {busy === "save" ? "Đang lưu…" : "Lưu cấu hình"}
              </button>
              {data.configured && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void sendTest()}
                >
                  <Send size={16} aria-hidden="true" />
                  {busy === "test" ? "Đang gửi…" : "Gửi thư thử"}
                </button>
              )}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
