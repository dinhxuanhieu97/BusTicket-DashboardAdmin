"use client";

import { useEffect, useState, type FormEvent } from "react";
import { operation } from "./operations-client";

type PaymentAccount = {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reconcileEnabled: boolean;
};
type AccountResponse = { account: PaymentAccount | null };
const resource = "payment-account";

export function PaymentAccountSettings() {
  const [data, setData] = useState<AccountResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      setData(await operation<AccountResponse>(resource));
    } catch (error) {
      setError((error as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const apiToken = String(fields.get("apiToken")).trim();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await operation<AccountResponse>(resource, "PUT", {
        bankCode: String(fields.get("bankCode")),
        accountNumber: String(fields.get("accountNumber")),
        accountName: String(fields.get("accountName")),
        webhookApiKey: String(fields.get("webhookApiKey")).trim(),
        ...(apiToken ? { apiToken } : {}),
      });
      form.reset();
      setData(updated);
      setNotice("Đã lưu tài khoản nhận tiền.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const account = data?.account;
  return (
    <section
      className="card space-y-4 p-6"
      aria-labelledby="payment-account-title"
    >
      <h2 id="payment-account-title" className="font-bold">
        Tài khoản nhận tiền
      </h2>
      <p className="text-sm text-muted">
        Mini App dùng thông tin này để tạo mã QR và hướng dẫn khách chuyển khoản
        đặt cọc.
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
      {!data ? (
        error ? (
          <button type="button" className="btn" onClick={() => void load()}>
            Tải lại
          </button>
        ) : (
          <p role="status">Đang tải tài khoản nhận tiền…</p>
        )
      ) : (
        <form key={JSON.stringify(account)} onSubmit={save}>
          <fieldset disabled={saving} className="max-w-2xl space-y-4">
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <label className="label">
                Mã ngân hàng
                <input
                  name="bankCode"
                  className="field mt-2"
                  placeholder="Ví dụ MB"
                  defaultValue={account?.bankCode}
                  required
                  pattern="[A-Za-z0-9]{2,20}"
                  maxLength={20}
                />
              </label>
              <label className="label">
                Số tài khoản
                <input
                  name="accountNumber"
                  className="field mt-2"
                  defaultValue={account?.accountNumber}
                  required
                  pattern="[A-Za-z0-9]{4,30}"
                  maxLength={30}
                />
              </label>
            </div>
            <label className="label">
              Tên chủ tài khoản
              <input
                name="accountName"
                className="field mt-2"
                defaultValue={account?.accountName}
                required
                maxLength={120}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label">
                API Key webhook SePay
                <input
                  name="webhookApiKey"
                  type="password"
                  autoComplete="off"
                  className="field mt-2"
                  required
                  minLength={24}
                  maxLength={200}
                />
              </label>
              <label className="label">
                Token API SePay{account?.reconcileEnabled ? "" : " (tùy chọn)"}
                <input
                  name="apiToken"
                  type="password"
                  autoComplete="off"
                  className="field mt-2"
                  required={account?.reconcileEnabled}
                  minLength={10}
                  maxLength={500}
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              Dùng đúng API Key đã cấu hình trên SePay để nhận thông báo chuyển
              khoản. Token API dùng cho đối soát tự động.
              {account &&
                " Nếu đổi số tài khoản, hãy kiểm tra các đơn đang chờ thanh toán vì khách có thể đã lưu mã QR cũ."}
            </p>
            <button className="btn btn-primary" type="submit">
              {saving ? "Đang lưu…" : "Lưu tài khoản nhận tiền"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
