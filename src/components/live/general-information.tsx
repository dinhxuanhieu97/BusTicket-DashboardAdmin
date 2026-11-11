"use client";
import { Notice } from "./shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { RouteStopsEditor } from "./route-stops-editor";
import { PaymentAccountSettings } from "./payment-account-settings";
import { operation } from "./operations-client";
import { SuccessToast, type SuccessMessage } from "./success-toast";
import type { TripOptions } from "@/lib/trip-management";
import { LOGO_MAX_BYTES, LOGO_TYPES, logoUrl } from "@/lib/brand";
import { BrandMark } from "./brand";
export type OperatorProfile = {
  id: string;
  code: string;
  name: string;
  defaultDepartureTime: string;
  logoVersion?: string | null;
};
export function GeneralInformation({
  canConfigurePayments,
  mfaEnabled,
}: {
  canConfigurePayments: boolean;
  mfaEnabled: boolean;
}) {
  const [profile, setProfile] = useState<OperatorProfile | null>(null),
    [options, setOptions] = useState<TripOptions | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState<SuccessMessage | null>(null),
    [busy, setBusy] = useState(false);
  const nextNoticeId = useRef(0);
  const showSuccess = (text: string) =>
    setNotice({ id: ++nextNoticeId.current, text });
  const dismissSuccess = useCallback((id: number) => {
    setNotice((current) => (current?.id === id ? null : current));
  }, []);
  const load = async () => {
    try {
      const [p, o] = await Promise.all([
        operation<OperatorProfile>("profile"),
        fetch("/api/trip-management/options").then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw Error(b.error?.message);
          return b;
        }),
      ]);
      setProfile(p);
      setOptions(o);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function save(
    action: () => Promise<unknown>,
    success = "Đã lưu thông tin.",
  ) {
    setBusy(true);
    setError("");
    try {
      await action();
      showSuccess(success);
      await load();
      window.dispatchEvent(new Event("operator-profile-updated"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pn-page-stack">
      <p className="text-sm text-muted">
        Thông tin được quản lý riêng cho nhà xe của bạn. Tên xe và tuyến được
        dùng trong lịch chạy và đặt vé.
      </p>
      {error && <Notice tone="danger">{error}</Notice>}
      <SuccessToast message={notice} dismiss={dismissSuccess} />
      {!profile && !error && <p>Đang tải thông tin nhà xe…</p>}
      {profile && (
        <form
          className="card space-y-4 pn-panel-inset"
          onSubmit={(e) => {
            e.preventDefault();
            void save(() =>
              operation("profile", "PUT", {
                name: profile.name,
                defaultDepartureTime: profile.defaultDepartureTime,
              }),
            );
          }}
        >
          <h2 className="text-base font-semibold">Nhà xe · {profile.code}</h2>
          <div className="pn-form-grid max-w-2xl sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="label">
              Tên nhà xe
              <input
                required
                maxLength={120}
                className="field"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </label>
            <label className="label">
              Giờ xuất bến mặc định
              <input
                required
                type="time"
                className="field"
                value={profile.defaultDepartureTime}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    defaultDepartureTime: e.target.value,
                  })
                }
              />
            </label>
          </div>
          <p className="text-xs text-muted">
            Áp dụng cho form tạo mới. Lịch đã lưu có giờ riêng; dùng ngoại lệ để
            thay đổi một ngày cụ thể.
          </p>
          <button className="btn btn-primary" disabled={busy}>
            Lưu thông tin nhà xe
          </button>
        </form>
      )}
      {profile && (
        <LogoSettings
          profile={profile}
          busy={busy}
          onChange={save}
          onError={setError}
        />
      )}
      {canConfigurePayments && (
        <PaymentAccountSettings
          mfaEnabled={mfaEnabled}
          onSuccess={showSuccess}
        />
      )}
      <section className="card space-y-4 pn-panel-inset">
        <h2 className="text-base font-semibold">Xe</h2>
        {options?.vehicles.map((v) => (
          <form
            key={v.id}
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save(() =>
                operation(`vehicles/${v.id}`, "PATCH", {
                  name: form.get("name"),
                }),
              );
            }}
          >
            <label className="label flex-1">
              {v.code} · Tên hiển thị
              <input
                key={v.name}
                name="name"
                className="field"
                defaultValue={v.name}
                required
                maxLength={60}
              />
            </label>
            <button className="btn" disabled={busy}>
              Lưu tên xe
            </button>
          </form>
        ))}
      </section>
      <section className="card space-y-4 pn-panel-inset">
        <h2 className="text-base font-semibold">Tuyến hai chiều</h2>
        <ul className="space-y-2 text-sm">
          {options?.routes.map((r) => (
            <li key={r.id}>
              <details className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer">
                  {r.code} · {r.origin} → {r.destination}
                </summary>
                <RouteStopsEditor
                  initial={r.stops}
                  busy={busy}
                  onSave={(stops) =>
                    void save(() =>
                      operation(`routes/${r.id}/stops`, "PUT", stops),
                    )
                  }
                />
              </details>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void save(() =>
              operation(
                "route-pairs",
                "POST",
                Object.fromEntries(form.entries()),
              ),
            );
          }}
        >
          {[
            ["origin", "Điểm đầu"],
            ["destination", "Điểm cuối"],
            ["code", "Mã chiều đi"],
            ["reverseCode", "Mã chiều về"],
          ].map(([name, label]) => (
            <label className="label" key={name}>
              {label}
              <input
                className="field"
                name={name}
                required
                maxLength={name.includes("ode") ? 32 : 80}
                pattern={name.includes("ode") ? "[A-Z0-9-]{2,32}" : undefined}
              />
            </label>
          ))}
          <button
            className="btn btn-primary sm:col-span-2 sm:justify-self-start"
            disabled={busy}
          >
            Lưu cặp tuyến
          </button>
        </form>
        <p className="text-xs text-muted">
          Mã đã có cùng địa điểm sẽ được giữ lại. Timeline đón/trả sẽ cấu hình
          riêng cho từng chiều khi có giờ chính xác.
        </p>
      </section>
    </div>
  );
}

/** Logo hiển thị ở trang đăng nhập và menu (PNG/JPEG/WebP ≤ 200 KB; API kiểm tra lại chữ ký tệp). */
function LogoSettings({
  profile,
  busy,
  onChange,
  onError,
}: {
  profile: OperatorProfile;
  busy: boolean;
  onChange: (action: () => Promise<unknown>, text: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const url = logoUrl(profile.code, profile.logoVersion ?? null);
  async function send(method: "PUT" | "DELETE", file?: File) {
    const res = await fetch("/api/operations/logo", {
      method,
      headers: { "Content-Type": file ? file.type : "application/json" },
      ...(file ? { body: file } : {}),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) window.location.replace("/login");
    if (!res.ok) throw Error(body.error?.message || "Không lưu được logo.");
  }
  return (
    <section
      aria-labelledby="logo-heading"
      className="card space-y-3 pn-panel-inset"
    >
      <h2 id="logo-heading" className="text-base font-semibold">
        Logo nhà xe
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <BrandMark name={profile.name} logoUrl={url} />
        <p className="min-w-0 flex-1 text-sm text-muted">
          Hiển thị cùng tên nhà xe ở trang đăng nhập và menu. PNG, JPEG hoặc
          WebP, tối đa 200 KB; nên dùng ảnh vuông.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="btn">
          {url ? "Đổi logo" : "Tải logo lên"}
          <input
            ref={input}
            type="file"
            accept={LOGO_TYPES.join(",")}
            className="sr-only"
            disabled={busy}
            aria-label="Chọn tệp logo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (
                !(LOGO_TYPES as readonly string[]).includes(file.type) ||
                file.size > LOGO_MAX_BYTES
              )
                return onError(
                  "Logo phải là ảnh PNG, JPEG hoặc WebP, tối đa 200 KB.",
                );
              void onChange(() => send("PUT", file), "Đã cập nhật logo.");
            }}
          />
        </label>
        {url && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void onChange(() => send("DELETE"), "Đã xóa logo.")}
          >
            Xóa logo
          </button>
        )}
      </div>
    </section>
  );
}
