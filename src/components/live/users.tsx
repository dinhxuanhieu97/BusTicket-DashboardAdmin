"use client";
import { useState } from "react";
import { AppUser, roleLabels } from "@/lib/live-contracts";
import { useResource } from "./use-resource";
import {
  LoadState,
  RefreshButton,
  EmptyRow,
  tableClass,
  thClass,
  tdClass,
} from "./shared";
export function Staff() {
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useResource<{ users: AppUser[] }>(
    "users",
  );
  const users = (data?.users || []).filter((u) =>
    `${u.fullName} ${u.phone} ${roleLabels[u.role]}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Tài khoản nhân viên thuộc nhà xe của bạn.
          </p>
          <p className="mt-1 text-xs text-muted">
            API chưa cung cấp trạng thái hoạt động và lần đăng nhập cuối.
          </p>
        </div>
        <RefreshButton reload={reload} loading={loading} />
      </div>
      <input
        className="field sm:max-w-sm"
        aria-label="Tìm nhân viên"
        placeholder="Tên, số điện thoại, vai trò…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <LoadState loading={loading} error={error} reload={reload} />
      {!loading && !error && data && (
        <section className="card">
          <h2 className="p-5 font-bold">{users.length} nhân viên</h2>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  {["Họ tên", "Số điện thoại", "Vai trò", "Xác thực 2FA"].map(
                    (h) => (
                      <th className={thClass} key={h}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className={tdClass}>{u.fullName}</td>
                    <td className={tdClass + " font-mono"}>{u.phone}</td>
                    <td className={tdClass}>{roleLabels[u.role]}</td>
                    <td className={tdClass}>
                      <span
                        className={
                          u.mfaEnabled ? "text-emerald-500" : "text-muted"
                        }
                      >
                        {u.mfaEnabled ? "Đã bật" : "Chưa bật"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!users.length && <EmptyRow columns={4} />}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
