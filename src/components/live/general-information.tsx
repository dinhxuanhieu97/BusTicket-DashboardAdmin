"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Notice } from "./shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentAccountSettings } from "./payment-account-settings";
import { operation } from "./operations-client";
import { SuccessToast, type SuccessMessage } from "./success-toast";
import type { TripOptions } from "@/lib/trip-management";
import { LOGO_MAX_BYTES, LOGO_TYPES, logoUrl } from "@/lib/brand";
import { BrandMark } from "./brand";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLORS,
  HEX_COLOR,
  brandPalette,
  type BrandColors,
} from "@/lib/brand-palette";
export type OperatorProfile = {
  id: string;
  code: string;
  name: string;
  defaultDepartureTime: string;
  logoVersion?: string | null;
  brandColors?: BrandColors | null;
};
export function GeneralInformation({
  canConfigurePayments,
  canReadFleet,
  canReadRoutes,
  mfaEnabled,
}: {
  canConfigurePayments: boolean;
  canReadFleet: boolean;
  canReadRoutes: boolean;
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
  const logo = profile
    ? logoUrl(profile.code, profile.logoVersion ?? null)
    : null;
  const showOperations = canReadFleet || canReadRoutes;
  return (
    <div className="pn-settings-groups">
      {error && <Notice tone="danger">{error}</Notice>}
      <SuccessToast message={notice} dismiss={dismissSuccess} />
      {!profile && !error && <p>Đang tải thông tin nhà xe…</p>}
      {profile && (
        <SettingsGroup
          id="profile"
          title="Hồ sơ nhà xe"
          description="Tên hiển thị cho khách và giờ xuất bến gợi ý khi tạo lịch chạy."
        >
          <form
            aria-labelledby="group-profile-heading"
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
            <div className="pn-form-grid sm:grid-cols-[minmax(0,1fr)_8rem_11rem]">
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
                Mã nhà xe
                <input
                  readOnly
                  className="field font-mono text-muted"
                  value={profile.code}
                  aria-describedby="profile-code-hint"
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
            <p id="profile-code-hint" className="text-xs text-muted">
              Mã nhà xe không đổi được. Giờ mặc định chỉ áp dụng cho form tạo
              mới; lịch đã lưu giữ giờ riêng, dùng ngoại lệ để đổi một ngày cụ
              thể.
            </p>
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={busy}>
                Lưu hồ sơ
              </button>
            </div>
          </form>
        </SettingsGroup>
      )}
      {profile && (
        <SettingsGroup
          id="identity"
          title="Nhận diện"
          description="Logo và màu giao diện hiển thị ở trang đăng nhập, menu và mọi tài khoản của nhà xe."
        >
          <div className="card pn-panel-inset pn-identity">
            <LogoSettings
              profile={profile}
              busy={busy}
              onChange={save}
              onError={setError}
            />
            <BrandColorSettings
              key={JSON.stringify(profile.brandColors ?? null)}
              saved={profile.brandColors ?? null}
              name={profile.name}
              logoUrl={logo}
              busy={busy}
              onChange={save}
            />
          </div>
        </SettingsGroup>
      )}
      {canConfigurePayments && (
        <SettingsGroup
          id="payments"
          title="Thanh toán"
          description="Khách chuyển khoản đặt cọc vào tài khoản này qua mã QR trong Mini App."
        >
          <PaymentAccountSettings
            mfaEnabled={mfaEnabled}
            onSuccess={showSuccess}
          />
        </SettingsGroup>
      )}
      {showOperations && (
        <SettingsGroup
          id="operations"
          title="Dữ liệu vận hành"
          description="Xe và tuyến dùng trong lịch chạy và đặt vé; quản lý ở trang riêng."
        >
          <ul className="card pn-link-list">
            {canReadFleet && (
              <li>
                <Link href="/admin/vehicles" className="pn-link-row">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Xe</h3>
                    <p className="text-sm text-muted">
                      {options
                        ? `${options.vehicles.length} xe đang chạy · `
                        : ""}
                      Thêm, sửa, đổi trạng thái ở trang Đội xe
                    </p>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </li>
            )}
            {canReadRoutes && (
              <li>
                <Link href="/admin/routes" className="pn-link-row">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Tuyến đường</h3>
                    <p className="text-sm text-muted">
                      {options ? `${options.routes.length} tuyến · ` : ""}
                      Cặp tuyến, điểm đi/đến, điểm đón/trả
                    </p>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </li>
            )}
          </ul>
        </SettingsGroup>
      )}
    </div>
  );
}

/** Một nhóm cài đặt: tên và mô tả bên trái (màn rộng), nội dung bên phải. */
function SettingsGroup({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="pn-settings-group"
      aria-labelledby={`group-${id}-heading`}
    >
      <div className="space-y-1">
        <h2 id={`group-${id}-heading`} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
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
    <section aria-labelledby="logo-heading" className="space-y-3">
      <h3 id="logo-heading" className="text-sm font-semibold">
        Logo nhà xe
      </h3>
      <div className="flex flex-wrap items-center gap-4">
        <BrandMark name={profile.name} logoUrl={url} />
        <p className="min-w-0 flex-1 text-sm text-muted">
          PNG, JPEG hoặc WebP, tối đa 200 KB; nên dùng ảnh vuông. Chưa có logo
          thì dùng chữ cái đầu trên nền màu giao diện.
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

const sameColors = (a: BrandColors, b: BrandColors) =>
  a.from.toLowerCase() === b.from.toLowerCase() &&
  a.to.toLowerCase() === b.to.toLowerCase();

/**
 * Màu giao diện Dashboard: hai màu của dải chuyển (góc trên trái → góc dưới phải). Nút, liên kết và vệt sáng
 * nền suy ra từ hai màu này, tự chỉnh độ sáng để chữ luôn đọc được ở cả theme sáng và tối.
 */
function BrandColorSettings({
  saved,
  name,
  logoUrl,
  busy,
  onChange,
}: {
  saved: BrandColors | null;
  name: string;
  logoUrl: string | null;
  busy: boolean;
  onChange: (action: () => Promise<unknown>, text: string) => Promise<void>;
}) {
  const current = saved ?? DEFAULT_BRAND_COLORS;
  const [draft, setDraft] = useState<BrandColors>(current);
  // Ô nhập mã hex giữ chữ đang gõ dở; chỉ đổi `draft` khi đủ dạng #rrggbb.
  const [text, setText] = useState<BrandColors>(current);
  const valid = HEX_COLOR.test(draft.from) && HEX_COLOR.test(draft.to);
  const dirty = !sameColors(draft, current);
  const [light, setLight] = useState(false);
  useEffect(() => {
    const read = () =>
      setLight(document.documentElement.dataset.theme === "light");
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => watch.disconnect();
  }, []);
  const preview = brandPalette(draft)[light ? "light" : "dark"];
  const pick = (c: BrandColors) => {
    setDraft(c);
    setText(c);
  };
  const setEnd = (end: keyof BrandColors, value: string) => {
    setText((t) => ({ ...t, [end]: value }));
    const v = value.startsWith("#") ? value : `#${value}`;
    if (HEX_COLOR.test(v)) setDraft((d) => ({ ...d, [end]: v.toLowerCase() }));
  };
  const ends: { end: keyof BrandColors; label: string }[] = [
    { end: "from", label: "Màu đầu (góc trên trái)" },
    { end: "to", label: "Màu cuối (góc dưới phải)" },
  ];
  return (
    <form
      aria-labelledby="brand-colors-heading"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || !dirty) return;
        const colors = sameColors(draft, DEFAULT_BRAND_COLORS) ? null : draft;
        void onChange(
          () => operation("brand-colors", "PUT", { colors }),
          "Đã cập nhật màu giao diện.",
        );
      }}
    >
      <div className="space-y-1">
        <h3 id="brand-colors-heading" className="text-sm font-semibold">
          Màu giao diện
        </h3>
        <p className="text-sm text-muted">
          Áp dụng cho logo chữ, nút chính, liên kết và nền Dashboard. Mặc định
          là dải tím chàm → xanh lơ như biểu tượng trang.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Chọn nhanh</legend>
        <div className="pn-swatches">
          {BRAND_PRESETS.map((p) => {
            const on = sameColors(p.colors, draft);
            return (
              <button
                key={p.name}
                type="button"
                className="pn-swatch"
                aria-pressed={on}
                aria-label={p.name}
                title={p.name}
                disabled={busy}
                style={{
                  background: `linear-gradient(135deg, ${p.colors.from}, ${p.colors.to})`,
                }}
                onClick={() => pick(p.colors)}
              />
            );
          })}
        </div>
      </fieldset>

      <div className="pn-form-grid max-w-2xl sm:grid-cols-2">
        {ends.map(({ end, label }) => {
          const bad = !HEX_COLOR.test(
            text[end].startsWith("#") ? text[end] : `#${text[end]}`,
          );
          return (
            <div key={end} className="label">
              <span id={`brand-${end}-label`}>{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="pn-color-well"
                  aria-labelledby={`brand-${end}-label`}
                  value={draft[end]}
                  disabled={busy}
                  onChange={(e) => setEnd(end, e.target.value)}
                />
                <input
                  className="field font-mono uppercase"
                  aria-label={`${label}, mã màu`}
                  aria-invalid={bad}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  value={text[end]}
                  disabled={busy}
                  onChange={(e) => setEnd(end, e.target.value.trim())}
                  onBlur={() => setText((t) => ({ ...t, [end]: draft[end] }))}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="pn-brand-preview"
        data-testid="brand-preview"
        aria-label="Xem trước"
        role="group"
      >
        {logoUrl ? (
          <BrandMark name={name} logoUrl={logoUrl} />
        ) : (
          <span
            className="pn-brand"
            aria-hidden="true"
            style={{ background: preview["--brand-gradient"] }}
          >
            {name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        <span
          className="btn pointer-events-none"
          aria-hidden="true"
          style={{
            background: preview["--primary-gradient"],
            color: preview["--on-primary-gradient"],
            borderColor: "transparent",
          }}
        >
          Nút chính
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: preview["--accent"] }}
        >
          Liên kết
        </span>
        <span
          className="pn-brand-preview-bar"
          aria-hidden="true"
          style={{ background: preview["--brand-gradient"] }}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn btn-primary" disabled={busy || !valid || !dirty}>
          Lưu màu
        </button>
        {dirty && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => pick(current)}
          >
            Bỏ thay đổi
          </button>
        )}
        {saved && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              void onChange(
                () => operation("brand-colors", "PUT", { colors: null }),
                "Đã khôi phục màu mặc định.",
              )
            }
          >
            Khôi phục mặc định
          </button>
        )}
      </div>
    </form>
  );
}
