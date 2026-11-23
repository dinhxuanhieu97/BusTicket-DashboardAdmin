import { z } from "zod";

/** Máy chủ gửi mail hay dùng; "Khác" thì chủ xe tự nhập tên máy chủ và cổng. */
export const SMTP_PRESETS = [
  { id: "gmail", label: "Gmail", host: "smtp.gmail.com", port: 465 },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
  },
  { id: "zoho", label: "Zoho Mail", host: "smtp.zoho.com", port: 465 },
] as const;
export type SmtpPresetId = (typeof SMTP_PRESETS)[number]["id"] | "custom";

export const presetFor = (host: string): SmtpPresetId =>
  SMTP_PRESETS.find((p) => p.host === host)?.id ?? "custom";

/** `GET alert-settings` (API không bao giờ trả mật khẩu SMTP). */
export const alertSettingsSchema = z.object({
  configured: z.boolean(),
  enabled: z.boolean(),
  smtpHost: z.string(),
  smtpPort: z.union([z.literal(465), z.literal(587)]),
  smtpUser: z.string(),
  fromName: z.string().nullable(),
  recipients: z.array(z.string()),
  onBookingHeld: z.boolean(),
  onPaymentProof: z.boolean(),
  passwordSet: z.boolean(),
  lastSentAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
});
export type AlertSettings = z.infer<typeof alertSettingsSchema>;

/** Thân `PUT alert-settings` (API kiểm lại đầy đủ; ở đây chặn sớm dữ liệu rõ ràng sai). */
export const alertSettingsInput = z.strictObject({
  enabled: z.boolean(),
  smtpHost: z.string().trim().min(4).max(253),
  smtpPort: z.union([z.literal(465), z.literal(587)]),
  smtpUser: z.string().trim().min(3).max(254),
  smtpPassword: z.string().min(1).max(200).optional(),
  fromName: z.string().trim().max(80).nullable(),
  recipients: z.array(z.string().trim().min(3).max(254)).min(1).max(5),
  onBookingHeld: z.boolean(),
  onPaymentProof: z.boolean(),
  password: z.string().min(1).max(128),
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

/** Ô "Email nhận": mỗi dòng hoặc dấu phẩy/chấm phẩy một địa chỉ; bỏ dòng trống và trùng (không phân biệt hoa thường). */
export function parseRecipients(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const v = raw.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}
