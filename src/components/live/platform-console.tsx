"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Building,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { PasswordInput } from "@/components/password-input";
import type { Session } from "@/lib/live-contracts";
import {
  OPERATOR_CODE,
  randomTemporaryPassword,
  type OwnerAccount,
  type PlatformOperator,
} from "@/lib/platform";
import { LogoutButton } from "./auth-forms";
import { ChangePasswordForm } from "./password-forms";
import { TwoFactorSettings } from "./two-factor-settings";
import { LoadState, Notice, StatusBadge } from "./shared";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.replace("/login");
    throw Error("Phiên đăng nhập đã hết hạn.");
  }
  if (!res.ok) throw Error(body.error?.message || "Không tải được dữ liệu.");
  return body as T;
}

/** Khu quản trị nền tảng: tạo nhà xe và chủ xe, đặt mật khẩu tạm cho chủ xe quên mật khẩu, và tài khoản của chính mình. */
export function PlatformConsole({ user }: { user: Session["user"] }) {
  const [operators, setOperators] = useState<PlatformOperator[] | null>(null);
  const [operatorId, setOperatorId] = useState("");
  const [owners, setOwners] = useState<OwnerAccount[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<OwnerAccount | null>(null);
  const [notice, setNotice] = useState("");
  const [creatingOperator, setCreatingOperator] = useState(false);
  const [creatingOwner, setCreatingOwner] = useState(false);

  useEffect(() => {
    getJson<{ operators: PlatformOperator[] }>("/api/platform/operators")
      .then((d) => {
        setOperators(d.operators);
        setOperatorId((id) => id || d.operators[0]?.id || "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!operatorId) return;
    let live = true;
    setOwners(null);
    getJson<{ owners: OwnerAccount[] }>(
      `/api/platform/operators/${encodeURIComponent(operatorId)}/owners`,
    )
      .then((d) => live && setOwners(d.owners))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [operatorId, revision]);

  const operator = operators?.find((o) => o.id === operatorId);

  return (
    <main className="pn-page-inline mx-auto max-w-4xl space-y-6 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Quản trị nền tảng PNTicket</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.fullName}
          </h1>
        </div>
        <div className="w-40">
          <LogoutButton />
        </div>
      </header>

      <section
        aria-labelledby="operators-heading"
        className="card pn-panel-inset flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h2
            id="operators-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <Building size={18} aria-hidden="true" /> Danh sách nhà xe
          </h2>
          <p className="mt-1 text-sm text-muted">
            {operators
              ? `${operators.length} nhà xe trên nền tảng.`
              : "Đang tải danh sách nhà xe…"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setNotice("");
            setCreatingOperator(true);
          }}
          disabled={!operators}
        >
          <Plus size={15} aria-hidden="true" /> Tạo nhà xe
        </button>
      </section>

      <section
        aria-labelledby="owners-heading"
        className="card pn-panel-inset space-y-4"
      >
        <div>
          <h2
            id="owners-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <KeyRound size={18} aria-hidden="true" /> Mật khẩu chủ xe
          </h2>
          <p className="mt-1 text-sm text-muted">
            Dùng khi chủ xe quên mật khẩu và chưa bật 2FA (chủ xe có 2FA tự đặt
            lại ở trang Quên mật khẩu). Xác minh danh tính chủ xe qua kênh khác
            trước khi đặt. Chủ xe phải đổi mật khẩu tạm ở lần đăng nhập sau.
          </p>
        </div>
        {error && (
          <LoadState
            error={error}
            reload={() => {
              setError("");
              setRevision((n) => n + 1);
            }}
          />
        )}
        {operators && operators.length === 0 && (
          <p className="text-sm text-muted">Chưa có nhà xe nào.</p>
        )}
        {operators && operators.length > 0 && (
          <div className="pn-field-group max-w-sm">
            <label className="label" htmlFor="platform-operator">
              Nhà xe
            </label>
            <select
              id="platform-operator"
              className="field"
              value={operatorId}
              onChange={(e) => {
                setNotice("");
                setOperatorId(e.target.value);
              }}
            >
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {notice && <Notice tone="success">{notice}</Notice>}
        {operatorId && !owners && !error && (
          <p className="text-sm text-muted" role="status">
            Đang tải chủ xe…
          </p>
        )}
        {owners && owners.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {operator?.code} · {operator?.name} chưa có tài khoản chủ xe.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNotice("");
                setCreatingOwner(true);
              }}
            >
              <UserPlus size={15} aria-hidden="true" /> Tạo tài khoản chủ xe
            </button>
          </div>
        )}
        {owners && owners.length > 0 && (
          <ul
            className="divide-y divide-line/40"
            aria-label={`Chủ xe của ${operator?.name ?? "nhà xe"}`}
          >
            {owners.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink wrap-anywhere">
                    {o.fullName}
                  </p>
                  <p className="font-mono text-xs text-muted">{o.phone}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusBadge
                      tone={o.status === "ACTIVE" ? "success" : "neutral"}
                      label={
                        o.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"
                      }
                    />
                    <StatusBadge
                      tone={o.mfaEnabled ? "info" : "warning"}
                      icon={ShieldCheck}
                      label={o.mfaEnabled ? "Đã bật 2FA" : "Chưa bật 2FA"}
                    />
                    {o.mustChangePassword && (
                      <StatusBadge
                        tone="warning"
                        label="Chờ đổi mật khẩu tạm"
                      />
                    )}
                    {o.lockedUntil && (
                      <StatusBadge
                        tone="danger"
                        label="Tạm khóa do đăng nhập sai"
                      />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setNotice("");
                    setTarget(o);
                  }}
                  aria-label={`Đặt mật khẩu tạm cho ${o.fullName}`}
                >
                  <KeyRound size={15} aria-hidden="true" /> Đặt mật khẩu tạm
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="platform-account-heading"
        className="card pn-panel-inset"
      >
        <h2
          id="platform-account-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Building size={18} aria-hidden="true" /> Tài khoản của bạn
        </h2>
        <p className="mt-1 font-mono text-sm text-muted">{user.phone}</p>
        <TwoFactorSettings enabled={user.mfaEnabled} />
        <section
          aria-labelledby="change-password-heading"
          className="mt-4 rounded-xl border border-line/60 bg-surface/20 p-4"
        >
          <h3
            id="change-password-heading"
            className="mb-3 text-base font-semibold"
          >
            Đổi mật khẩu
          </h3>
          <ChangePasswordForm />
        </section>
      </section>

      {creatingOperator && operators && (
        <CreateOperatorDialog
          existing={operators}
          onClose={() => setCreatingOperator(false)}
          onDone={(created) => {
            setCreatingOperator(false);
            setOperators((list) =>
              [...(list ?? []), created].sort((a, b) =>
                a.code.localeCompare(b.code),
              ),
            );
            setOperatorId(created.id);
            setNotice(
              `Đã tạo nhà xe ${created.code} · ${created.name} (kèm chính sách mặc định và 2 xe mẫu). Bước tiếp: tạo tài khoản chủ xe.`,
            );
          }}
        />
      )}
      {creatingOwner && operator && (
        <CreateOwnerDialog
          operator={operator}
          adminHasMfa={user.mfaEnabled}
          onClose={() => setCreatingOwner(false)}
          onCreated={(owner) => setOwners((list) => [...(list ?? []), owner])}
          onPartial={() => setRevision((n) => n + 1)}
        />
      )}
      {target && operator && (
        <TemporaryPasswordDialog
          owner={target}
          operator={operator}
          adminHasMfa={user.mfaEnabled}
          onClose={() => setTarget(null)}
          onDone={(owner) => {
            setTarget(null);
            setOwners(
              (list) =>
                list?.map((o) => (o.id === owner.id ? owner : o)) ?? list,
            );
            setNotice(
              `Đã đặt mật khẩu tạm cho ${owner.fullName}. Các phiên đăng nhập cũ đã bị đăng xuất; chủ xe phải đổi mật khẩu ở lần đăng nhập sau.`,
            );
          }}
        />
      )}
    </main>
  );
}

function TemporaryPasswordDialog({
  owner,
  operator,
  adminHasMfa,
  onClose,
  onDone,
}: {
  owner: OwnerAccount;
  operator: PlatformOperator;
  adminHasMfa: boolean;
  onClose: () => void;
  onDone: (owner: OwnerAccount) => void;
}) {
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (password.length < 10)
      return setError("Mật khẩu tạm tối thiểu 10 ký tự.");
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const res = await fetch(
        `/api/platform/operators/${encodeURIComponent(operator.id)}/owners/${encodeURIComponent(owner.id)}/temporary-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            adminPassword,
            ...(otp ? { otp } : {}),
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return window.location.replace("/login");
      if (!res.ok)
        throw Error(body.error?.message || "Không đặt được mật khẩu tạm.");
      setAdminPassword("");
      setOtp("");
      onDone(body.owner);
    } catch (err) {
      setAdminPassword("");
      setOtp("");
      setError(err instanceof Error ? err.message : "Mất kết nối API.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Modal title="Đặt mật khẩu tạm cho chủ xe" onClose={onClose}>
      <form onSubmit={submit} aria-busy={pending} className="space-y-4">
        <p className="text-sm text-muted wrap-anywhere">
          <strong className="text-ink">{owner.fullName}</strong> · {owner.phone}{" "}
          · {operator.name}. Gửi mật khẩu tạm cho chủ xe qua kênh đã xác minh;
          không gửi qua tin nhắn công khai.
        </p>
        <div className="pn-field-group">
          <div className="flex items-center justify-between gap-2">
            <label className="label" htmlFor="owner-temp-password">
              Mật khẩu tạm
            </label>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => setPassword(randomTemporaryPassword())}
              disabled={pending}
            >
              <RefreshCw size={13} aria-hidden="true" /> Tạo ngẫu nhiên
            </button>
          </div>
          <PasswordInput
            id="owner-temp-password"
            autoComplete="new-password"
            className="field font-mono"
            required
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          <p className="text-xs text-muted">Tối thiểu 10 ký tự.</p>
        </div>
        <fieldset className="space-y-3 rounded-xl border border-line/60 p-3">
          <legend className="px-1 text-xs text-muted">
            Xác nhận bằng tài khoản quản trị của bạn
          </legend>
          <div className="pn-field-group">
            <label className="label" htmlFor="platform-admin-password">
              Mật khẩu của bạn
            </label>
            <PasswordInput
              id="platform-admin-password"
              autoComplete="current-password"
              className="field"
              required
              maxLength={128}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={pending}
            />
          </div>
          {adminHasMfa && (
            <div className="pn-field-group">
              <label className="label" htmlFor="platform-admin-otp">
                Mã Authenticator của bạn
              </label>
              <input
                id="platform-admin-otp"
                className="field font-mono tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                disabled={pending}
              />
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="pn-tone pn-notice" data-tone="danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Đang lưu…" : "Đặt mật khẩu tạm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.replace("/login");
    throw Error("Phiên đăng nhập đã hết hạn.");
  }
  if (!res.ok) {
    const error = Error(data.error?.message || "Không lưu được.");
    (error as Error & { code?: string }).code = data.error?.code;
    throw error;
  }
  return data as T;
}

function CreateOperatorDialog({
  existing,
  onClose,
  onDone,
}: {
  existing: PlatformOperator[];
  onClose: () => void;
  onDone: (operator: PlatformOperator) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!OPERATOR_CODE.test(code))
      return setError("Mã nhà xe gồm 2–4 chữ cái in hoa, không dấu, không số.");
    if (existing.some((o) => o.code === code))
      return setError(`Mã ${code} đã được dùng.`);
    if (!name.trim()) return setError("Vui lòng nhập tên nhà xe.");
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const { operator } = await postJson<{ operator: PlatformOperator }>(
        "/api/platform/operators",
        { code, name: name.trim() },
      );
      onDone(operator);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mất kết nối API.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Modal title="Tạo nhà xe" onClose={onClose}>
      <form onSubmit={submit} aria-busy={pending} className="space-y-4">
        <div className="pn-field-group">
          <label className="label" htmlFor="new-operator-code">
            Mã nhà xe
          </label>
          <input
            id="new-operator-code"
            className="field font-mono uppercase tracking-wider"
            required
            autoComplete="off"
            maxLength={4}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            }
            disabled={pending}
            aria-describedby="new-operator-code-hint"
          />
          <p id="new-operator-code-hint" className="text-xs text-muted">
            2–4 chữ cái in hoa, ví dụ VHA. Mã là tiền tố của mã vé, mã xe và nội
            dung chuyển khoản nên không đổi được sau khi tạo.
          </p>
        </div>
        <div className="pn-field-group">
          <label className="label" htmlFor="new-operator-name">
            Tên nhà xe
          </label>
          <input
            id="new-operator-name"
            className="field"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </div>
        {error && (
          <p role="alert" className="pn-tone pn-notice" data-tone="danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Đang tạo…" : "Tạo nhà xe"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateOwnerDialog({
  operator,
  adminHasMfa,
  onClose,
  onCreated,
  onPartial,
}: {
  operator: PlatformOperator;
  adminHasMfa: boolean;
  onClose: () => void;
  onCreated: (owner: OwnerAccount) => void;
  onPartial: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    owner: OwnerAccount;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const submitting = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const data = await postJson<{
        owner: OwnerAccount;
        temporaryPassword: string;
      }>(`/api/platform/operators/${encodeURIComponent(operator.id)}/owners`, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        adminPassword,
        ...(otp ? { otp } : {}),
      });
      setResult(data);
      onCreated(data.owner);
    } catch (err) {
      if ((err as { code?: string }).code === "OWNER_CREATED_PASSWORD_NOT_SET")
        onPartial();
      setError(err instanceof Error ? err.message : "Mất kết nối API.");
    } finally {
      setAdminPassword("");
      setOtp("");
      submitting.current = false;
      setPending(false);
    }
  }

  if (result)
    return (
      <Modal title="Đã tạo tài khoản chủ xe" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-muted wrap-anywhere">
            <strong className="text-ink">{result.owner.fullName}</strong> ·{" "}
            {result.owner.phone} · {operator.name}. Gửi mật khẩu tạm cho chủ xe
            qua kênh đã xác minh. Mật khẩu chỉ hiện một lần; chủ xe phải đổi ở
            lần đăng nhập đầu tiên.
          </p>
          <div className="pn-field-group">
            <span className="label">Mật khẩu tạm</span>
            <div className="flex items-center gap-2">
              <code
                data-testid="owner-temporary-password"
                className="field flex-1 font-mono select-all"
              >
                {result.temporaryPassword}
              </code>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(result.temporaryPassword)
                    .then(() => setCopied(true))
                    .catch(() => {})
                }
              >
                <Copy size={15} aria-hidden="true" />{" "}
                {copied ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Xong
            </button>
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal title="Tạo tài khoản chủ xe" onClose={onClose}>
      <form onSubmit={submit} aria-busy={pending} className="space-y-4">
        <p className="text-sm text-muted">
          Nhà xe <strong className="text-ink">{operator.code}</strong> ·{" "}
          {operator.name}. Hệ thống tạo mật khẩu tạm ngẫu nhiên và hiện một lần
          sau khi tạo.
        </p>
        <div className="pn-field-group">
          <label className="label" htmlFor="new-owner-name">
            Họ tên chủ xe
          </label>
          <input
            id="new-owner-name"
            className="field"
            required
            maxLength={120}
            autoComplete="off"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="pn-field-group">
          <label className="label" htmlFor="new-owner-phone">
            Số điện thoại đăng nhập
          </label>
          <input
            id="new-owner-phone"
            className="field font-mono"
            required
            inputMode="tel"
            autoComplete="off"
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={pending}
          />
        </div>
        <fieldset className="space-y-3 rounded-xl border border-line/60 p-3">
          <legend className="px-1 text-xs text-muted">
            Xác nhận bằng tài khoản quản trị của bạn
          </legend>
          <div className="pn-field-group">
            <label className="label" htmlFor="create-owner-admin-password">
              Mật khẩu của bạn
            </label>
            <PasswordInput
              id="create-owner-admin-password"
              autoComplete="current-password"
              className="field"
              required
              maxLength={128}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={pending}
            />
          </div>
          {adminHasMfa && (
            <div className="pn-field-group">
              <label className="label" htmlFor="create-owner-admin-otp">
                Mã Authenticator của bạn
              </label>
              <input
                id="create-owner-admin-otp"
                className="field font-mono tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                disabled={pending}
              />
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="pn-tone pn-notice" data-tone="danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
