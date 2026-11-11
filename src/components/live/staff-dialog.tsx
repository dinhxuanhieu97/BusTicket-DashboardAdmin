"use client";

import { useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/modal";
import {
  roleLabels,
  staffRoleSchema,
  type StaffUser,
} from "@/lib/live-contracts";
import { Notice } from "./shared";

export type StaffAction =
  { kind: "create" } | { kind: "edit" | "delete"; user: StaffUser };

export function StaffDialog({
  action,
  viewerId,
  onClose,
  onSave,
}: {
  action: StaffAction;
  viewerId: string;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const user = action.kind === "create" ? undefined : action.user;
  const self = user?.id.toLowerCase() === viewerId.toLowerCase();
  const deleting = action.kind === "delete";
  const title = deleting
    ? "Xóa nhân viên"
    : user
      ? "Sửa nhân viên"
      : "Thêm nhân viên";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const fields: Record<string, string> = {};
    for (const [key, value] of new FormData(event.currentTarget)) {
      const text = String(value);
      const next = key === "password" ? text : text.trim();
      if (key === "password" && user && !next) continue;
      const previous = user?.[key as keyof StaffUser];
      if (next !== previous) fields[key] = next;
    }
    if (fields.fullName === "") {
      setError("Vui lòng nhập họ tên.");
      return;
    }
    if (fields.phone === "") {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    if (user && !deleting && !Object.keys(fields).length) {
      setError("Chưa có thay đổi để lưu.");
      return;
    }

    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await onSave(fields);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thực hiện được thao tác.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function close() {
    if (!submitting.current) onClose();
  }

  return (
    <Modal title={title} onClose={close}>
      <form onSubmit={submit} aria-busy={pending} className="space-y-4">
        {deleting ? (
          <p className="text-sm text-muted wrap-anywhere">
            Tài khoản <strong className="text-ink">{user?.fullName}</strong> sẽ
            bị ẩn khỏi danh sách và không thể đăng nhập.
          </p>
        ) : (
          <fieldset
            disabled={pending}
            className="pn-form-grid min-w-0 sm:grid-cols-2"
          >
            <label className="space-y-1 text-sm font-medium">
              <span>Họ tên</span>
              <input
                name="fullName"
                className="field"
                autoComplete="off"
                defaultValue={user?.fullName}
                required
                maxLength={120}
              />
            </label>
            <div className="space-y-1 text-sm font-medium">
              <label htmlFor="staff-phone">Số điện thoại</label>
              <input
                id="staff-phone"
                name="phone"
                className="field"
                type="tel"
                autoComplete="off"
                defaultValue={user?.phone}
                required
                maxLength={30}
                aria-describedby={self ? "staff-phone-hint" : undefined}
              />
              {self && (
                <span
                  id="staff-phone-hint"
                  className="block text-xs font-normal text-muted"
                >
                  Đổi số đăng nhập có thể yêu cầu bạn đăng nhập lại.
                </span>
              )}
            </div>
            {!self && (
              <label className="space-y-1 text-sm font-medium">
                <span>Vai trò</span>
                <select
                  name="role"
                  className="field"
                  defaultValue={user?.role ?? "SELLER"}
                >
                  {user && !staffRoleSchema.safeParse(user.role).success && (
                    <option value={user.role} disabled>
                      {roleLabels[user.role]}
                    </option>
                  )}
                  {staffRoleSchema.options.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {user && !self && (
              <label className="space-y-1 text-sm font-medium">
                <span>Trạng thái</span>
                <select
                  name="status"
                  className="field"
                  defaultValue={user.status}
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="DISABLED">Đã khóa</option>
                </select>
              </label>
            )}
            {!self && (
              <div className="space-y-1 text-sm font-medium sm:col-span-2">
                <label htmlFor="staff-password">
                  {user ? "Mật khẩu mới (không bắt buộc)" : "Mật khẩu"}
                </label>
                <input
                  id="staff-password"
                  name="password"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required={!user}
                  aria-describedby="staff-password-hint"
                />
                <span
                  id="staff-password-hint"
                  className="block text-xs font-normal text-muted"
                >
                  Từ 10 đến 128 ký tự.
                  {user &&
                    " Đây là mật khẩu tạm: nhân viên phải đổi sang mật khẩu riêng ở lần đăng nhập tiếp theo."}
                </span>
              </div>
            )}
          </fieldset>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={close}
          >
            Hủy
          </button>
          <button
            type="submit"
            className={deleting ? "btn pn-tone" : "btn btn-primary"}
            data-tone={deleting ? "danger" : undefined}
            disabled={pending}
          >
            {pending
              ? "Đang xử lý…"
              : deleting
                ? "Xác nhận xóa"
                : user
                  ? "Lưu thay đổi"
                  : "Tạo tài khoản"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
