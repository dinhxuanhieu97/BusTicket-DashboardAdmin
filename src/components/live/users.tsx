"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  roleLabels,
  staffListSchema,
  type StaffUser,
} from "@/lib/live-contracts";
import { LoadState, Notice, RefreshButton, StatusBadge } from "./shared";
import {
  DataTable,
  TableFooter,
  useTableState,
  type Column,
} from "./data-table";
import { FilterTabs } from "@/components/ui/filter-tabs";
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

type StatusFilter = "" | StaffUser["status"];

const statusLabels = { ACTIVE: "Hoạt động", DISABLED: "Đã khóa" } as const;

function staffColumns(viewerId: string): Column<StaffUser>[] {
  return [
    {
      key: "name",
      header: "Họ tên",
      render: (u) => (
        <StaffName
          user={u}
          self={u.id.toLowerCase() === viewerId.toLowerCase()}
        />
      ),
      sortValue: (u) => u.fullName,
    },
    {
      key: "phone",
      header: "Số điện thoại",
      render: (u) => (
        <span className="font-mono whitespace-nowrap text-muted">
          {u.phone}
        </span>
      ),
    },
    {
      key: "role",
      header: "Vai trò",
      render: (u) => roleLabels[u.role],
      sortValue: (u) => roleLabels[u.role],
      className: "whitespace-nowrap",
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (u) => <StaffStatus status={u.status} />,
      sortValue: (u) => statusLabels[u.status],
    },
    {
      key: "mfa",
      header: "Xác thực 2FA",
      render: (u) => <StaffMfa enabled={u.mfaEnabled} />,
      sortValue: (u) => (u.mfaEnabled ? "Đã bật" : "Chưa bật"),
    },
  ];
}

export function Staff({ viewerId }: { viewerId: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [role, setRole] = useState("");
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
    const kind = action.kind;
    const body =
      kind === "lock"
        ? { status: "DISABLED" }
        : kind === "unlock"
          ? { status: "ACTIVE" }
          : fields;
    await staffRequest(kind === "create" ? "" : `/${action.user.id}`, {
      method:
        kind === "create" ? "POST" : kind === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      ...(kind === "delete" ? {} : { body: JSON.stringify(body) }),
    });
    if (kind === "delete") focusHeading.current = true;
    setAction(null);
    const name = kind === "create" ? "" : action.user.fullName;
    setMessage(
      kind === "create"
        ? "Đã tạo tài khoản nhân viên."
        : kind === "delete"
          ? "Đã xóa tài khoản nhân viên."
          : kind === "lock"
            ? `Đã khóa tài khoản ${name}.`
            : kind === "unlock"
              ? `Đã mở khóa tài khoản ${name}.`
              : "Đã lưu thay đổi.",
    );
    reload();
  }

  const all = useMemo(() => users ?? [], [users]);
  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      all.filter(
        (user) =>
          (!status || user.status === status) &&
          (!role || user.role === role) &&
          `${user.fullName} ${user.phone} ${roleLabels[user.role]}`
            .toLowerCase()
            .includes(query),
      ),
    [all, status, role, query],
  );
  const columns = useMemo(() => staffColumns(viewerId), [viewerId]);
  const table = useTableState(rows, columns);
  const roles = [...new Set(all.map((u) => u.role))];
  const countOf = (s?: StaffUser["status"]) =>
    all.filter((u) => !s || u.status === s).length;
  const filtered = !!(query || status || role);

  return (
    <div className="pn-page-stack">
      <div className="pn-page-hero">
        <h2 ref={heading} tabIndex={-1} className="pn-page-hero-title">
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

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs<StatusFilter>
          label="Trạng thái tài khoản"
          value={status}
          onChange={(next) => {
            setStatus(next);
            table.resetPage();
          }}
          items={[
            {
              value: "",
              label: "Tất cả",
              count: users ? countOf() : undefined,
            },
            ...(["ACTIVE", "DISABLED"] as const).map((s) => ({
              value: s,
              label: statusLabels[s],
              count: users ? countOf(s) : undefined,
            })),
          ]}
        />
        <select
          className="field w-auto"
          aria-label="Lọc theo vai trò"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            table.resetPage();
          }}
        >
          <option value="">Mọi vai trò</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 basis-full sm:max-w-sm sm:basis-auto sm:flex-1">
          <input
            type="search"
            className="field pl-9 font-medium"
            aria-label="Tìm nhân viên"
            placeholder="Tên, số điện thoại, vai trò…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.resetPage();
            }}
          />
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </div>
      </div>

      {message && <Notice tone="success">{message}</Notice>}
      <LoadState loading={loading && !users} error={error} reload={reload} />

      {users && !error && (
        <section className="card overflow-hidden" aria-busy={loading}>
          <header className="pn-table-header">
            <h3 className="font-bold text-ink">
              {rows.length} nhân viên
              {filtered && (
                <span className="font-normal text-muted"> / {all.length}</span>
              )}
            </h3>
          </header>
          <DataTable
            label="Danh sách nhân viên"
            columns={columns}
            rows={table.visible}
            rowKey={(u) => u.id}
            sort={table.sort}
            onSort={table.onSort}
            emptyText={
              filtered
                ? "Không tìm thấy nhân viên phù hợp."
                : "Chưa có nhân viên."
            }
            actions={(user) => {
              const self = user.id.toLowerCase() === viewerId.toLowerCase();
              const locked = user.status === "DISABLED";
              return (
                <div className="inline-flex gap-2">
                  <button
                    type="button"
                    className="btn py-1.5 text-xs"
                    aria-label={`Chi tiết ${user.fullName}`}
                    disabled={loading}
                    onClick={() => openAction({ kind: "edit", user })}
                  >
                    Chi tiết
                  </button>
                  {!self && (
                    <button
                      type="button"
                      className="btn pn-tone py-1.5 text-xs"
                      data-tone={locked ? undefined : "danger"}
                      aria-label={`${locked ? "Mở khóa" : "Khóa"} ${user.fullName}`}
                      disabled={loading}
                      onClick={() =>
                        openAction({ kind: locked ? "unlock" : "lock", user })
                      }
                    >
                      {locked ? "Mở khóa" : "Khóa"}
                    </button>
                  )}
                </div>
              );
            }}
          />
          <TableFooter
            info={table.info}
            noun="nhân viên"
            setPage={table.setPage}
            pageSize={table.pageSize}
            setPageSize={table.setPageSize}
          />
        </section>
      )}
      {action && (
        <StaffDialog
          key={action.kind}
          action={action}
          viewerId={viewerId}
          onClose={() => setAction(null)}
          onSave={save}
          onDelete={
            action.kind === "edit"
              ? () => setAction({ kind: "delete", user: action.user })
              : undefined
          }
        />
      )}
    </div>
  );
}
