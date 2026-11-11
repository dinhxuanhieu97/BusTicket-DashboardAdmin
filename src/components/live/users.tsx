"use client";

import { useEffect, useRef, useState } from "react";
import {
  roleLabels,
  staffListSchema,
  type StaffUser,
} from "@/lib/live-contracts";
import {
  EmptyRow,
  LoadState,
  Notice,
  RefreshButton,
  StatusBadge,
  TableScroll,
  thClass,
  tdClass,
} from "./shared";
import { StaffDialog, type StaffAction } from "./staff-dialog";
import { Search, ShieldCheck, ShieldAlert, UserPlus } from "lucide-react";

async function staffRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`/api/staff${path}`, {
    cache: "no-store",
    ...options,
  });
  const body = await response.json();
  if (response.status === 401 || body?.error?.code === "OPERATOR_REQUIRED") {
    window.location.replace("/login");
  } else if (body?.error?.code === "MFA_SETUP_REQUIRED") {
    window.location.replace("/mfa");
  }
  if (!response.ok) {
    throw new Error(body?.error?.message || "Không thực hiện được yêu cầu.");
  }
  return body;
}

function StaffName({ user, self }: { user: StaffUser; self: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="pn-avatar size-9 shrink-0" aria-hidden="true">
        {user.fullName.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <span className="font-semibold text-ink wrap-anywhere">
          {user.fullName}
        </span>
        {self && <span className="ml-2 text-xs text-muted">(Bạn)</span>}
      </div>
    </div>
  );
}

function StaffStatus({ status }: { status: StaffUser["status"] }) {
  return (
    <StatusBadge
      tone={status === "ACTIVE" ? "success" : "warning"}
      label={status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
    />
  );
}

function StaffMfa({ enabled }: { enabled: boolean }) {
  return (
    <StatusBadge
      tone={enabled ? "success" : "neutral"}
      label={enabled ? "Đã bật" : "Chưa bật"}
      icon={enabled ? ShieldCheck : ShieldAlert}
    />
  );
}

function StaffActions({
  user,
  self,
  loading,
  onAction,
}: {
  user: StaffUser;
  self: boolean;
  loading: boolean;
  onAction: (action: StaffAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn"
        aria-label={`Sửa ${user.fullName}`}
        disabled={loading}
        onClick={() => onAction({ kind: "edit", user })}
      >
        Sửa
      </button>
      {!self && (
        <button
          type="button"
          className="btn pn-tone"
          data-tone="danger"
          aria-label={`Xóa ${user.fullName}`}
          disabled={loading}
          onClick={() => onAction({ kind: "delete", user })}
        >
          Xóa
        </button>
      )}
    </div>
  );
}

const staffCellClass = `${tdClass} max-lg:border-0 max-lg:py-1.5 lg:table-cell`;
const staffLabeledCellClass =
  "grid grid-cols-2 items-center justify-items-start gap-2 lg:table-cell";

export function Staff({ viewerId }: { viewerId: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<StaffAction | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!action && focusHeading.current) {
      heading.current?.focus();
      focusHeading.current = false;
    }
  }, [action]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = staffListSchema.parse(
          await staffRequest("", { signal: controller.signal }),
        );
        if (!controller.signal.aborted) setUsers(data.users);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Không tải được danh sách.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  function openAction(action: StaffAction) {
    setMessage("");
    setAction(action);
  }

  function reload() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  async function save(fields: Record<string, string>) {
    if (!action) return;
    const creating = action.kind === "create";
    const deleting = action.kind === "delete";
    await staffRequest(creating ? "" : `/${action.user.id}`, {
      method: creating ? "POST" : deleting ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      ...(deleting ? {} : { body: JSON.stringify(fields) }),
    });
    if (deleting) {
      focusHeading.current = true;
    }
    setAction(null);
    setMessage(
      creating
        ? "Đã tạo tài khoản nhân viên."
        : deleting
          ? "Đã xóa tài khoản nhân viên."
          : "Đã lưu thay đổi.",
    );
    reload();
  }

  const query = search.trim().toLowerCase();
  const visibleUsers = (users ?? []).filter((user) =>
    `${user.fullName} ${user.phone} ${roleLabels[user.role]}`
      .toLowerCase()
      .includes(query),
  );
  const empty = query
    ? "Không tìm thấy nhân viên phù hợp."
    : "Chưa có nhân viên.";

  return (
    <div className="pn-page-stack">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 ref={heading} tabIndex={-1} className="pn-section-label">
          Danh sách nhân viên
        </h2>
        <div className="flex flex-wrap gap-2">
          <RefreshButton reload={reload} loading={loading} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !!error}
            onClick={() => openAction({ kind: "create" })}
          >
            <UserPlus size={16} aria-hidden="true" />
            Thêm nhân viên
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <input
          type="search"
          className="field pl-9 font-medium"
          aria-label="Tìm nhân viên"
          placeholder="Tên, số điện thoại, vai trò…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>

      {message && <Notice tone="success">{message}</Notice>}
      <LoadState loading={loading && !users} error={error} reload={reload} />

      {users && !error && (
        <section className="card overflow-hidden" aria-busy={loading}>
          <header className="pn-table-header">
            <h3 className="font-bold text-ink">
              {visibleUsers.length} nhân viên
            </h3>
          </header>
          <TableScroll label="Danh sách nhân viên">
            <table
              role="table"
              aria-label="Nhân viên"
              className="pn-table block w-full border-collapse text-left text-sm lg:table lg:min-w-[650px]"
            >
              <thead
                role="rowgroup"
                className="sr-only lg:not-sr-only lg:table-header-group"
              >
                <tr role="row">
                  {[
                    "Họ tên",
                    "Số điện thoại",
                    "Vai trò",
                    "Trạng thái",
                    "Xác thực 2FA",
                    "Thao tác",
                  ].map((label) => (
                    <th
                      role="columnheader"
                      scope="col"
                      className={thClass}
                      key={label}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup" className="block lg:table-row-group">
                {visibleUsers.map((user) => {
                  const self = user.id.toLowerCase() === viewerId.toLowerCase();
                  return (
                    <tr
                      role="row"
                      key={user.id}
                      className="block border-b border-line py-2 last:border-b-0 lg:table-row lg:border-0"
                    >
                      <td role="cell" className={`${staffCellClass} block`}>
                        <StaffName user={user} self={self} />
                      </td>
                      <td
                        role="cell"
                        className={`${staffCellClass} ${staffLabeledCellClass}`}
                      >
                        <span
                          aria-hidden="true"
                          className="text-muted lg:hidden"
                        >
                          Số điện thoại
                        </span>
                        <span className="font-mono text-muted wrap-anywhere">
                          {user.phone}
                        </span>
                      </td>
                      <td
                        role="cell"
                        className={`${staffCellClass} ${staffLabeledCellClass}`}
                      >
                        <span
                          aria-hidden="true"
                          className="text-muted lg:hidden"
                        >
                          Vai trò
                        </span>
                        <span>{roleLabels[user.role]}</span>
                      </td>
                      <td
                        role="cell"
                        className={`${staffCellClass} ${staffLabeledCellClass}`}
                      >
                        <span
                          aria-hidden="true"
                          className="text-muted lg:hidden"
                        >
                          Trạng thái
                        </span>
                        <StaffStatus status={user.status} />
                      </td>
                      <td
                        role="cell"
                        className={`${staffCellClass} ${staffLabeledCellClass}`}
                      >
                        <span
                          aria-hidden="true"
                          className="text-muted lg:hidden"
                        >
                          Xác thực 2FA
                        </span>
                        <StaffMfa enabled={user.mfaEnabled} />
                      </td>
                      <td role="cell" className={`${staffCellClass} block`}>
                        <StaffActions
                          user={user}
                          self={self}
                          loading={loading}
                          onAction={openAction}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!visibleUsers.length && <EmptyRow columns={6} text={empty} />}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}
      {action && (
        <StaffDialog
          action={action}
          viewerId={viewerId}
          onClose={() => setAction(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
