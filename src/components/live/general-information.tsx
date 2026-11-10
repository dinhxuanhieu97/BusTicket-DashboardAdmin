"use client";
import { useEffect, useState } from "react";
import { RouteStopsEditor } from "./route-stops-editor";
import { PaymentAccountSettings } from "./payment-account-settings";
import { operation } from "./operations-client";
import type { TripOptions } from "@/lib/trip-management";
export type OperatorProfile = {
  id: string;
  code: string;
  name: string;
  defaultDepartureTime: string;
};
export function GeneralInformation({
  canConfigurePayments,
}: {
  canConfigurePayments: boolean;
}) {
  const [profile, setProfile] = useState<OperatorProfile | null>(null),
    [options, setOptions] = useState<TripOptions | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
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
  async function save(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice("Đã lưu thông tin.");
      await load();
      window.dispatchEvent(new Event("operator-profile-updated"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Thông tin được quản lý riêng cho nhà xe của bạn. Tên xe và tuyến được
        dùng trong lịch chạy và đặt vé.
      </p>
      {error && (
        <p role="alert" className="text-amber-500">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-500">
          {notice}
        </p>
      )}
      {!profile && !error && <p>Đang tải thông tin nhà xe…</p>}
      {profile && (
        <form
          className="card space-y-4 p-6"
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
          <h2 className="font-bold">Nhà xe · {profile.code}</h2>
          <label className="label">
            Tên nhà xe
            <input
              required
              maxLength={120}
              className="field mt-2"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </label>
          <label className="label">
            Giờ xuất bến mặc định
            <input
              required
              type="time"
              className="field mt-2"
              value={profile.defaultDepartureTime}
              onChange={(e) =>
                setProfile({ ...profile, defaultDepartureTime: e.target.value })
              }
            />
          </label>
          <p className="text-xs text-muted">
            Áp dụng cho form tạo mới. Lịch đã lưu có giờ riêng; dùng ngoại lệ để
            thay đổi một ngày cụ thể.
          </p>
          <button className="btn btn-primary" disabled={busy}>
            Lưu thông tin nhà xe
          </button>
        </form>
      )}
      {canConfigurePayments && <PaymentAccountSettings />}
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Xe</h2>
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
                className="field mt-2"
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
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Tuyến hai chiều</h2>
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
                className="field mt-2"
                name={name}
                required
                maxLength={name.includes("ode") ? 32 : 80}
                pattern={name.includes("ode") ? "[A-Z0-9-]{2,32}" : undefined}
              />
            </label>
          ))}
          <button className="btn btn-primary sm:col-span-2" disabled={busy}>
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
