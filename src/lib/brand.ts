/** Thương hiệu nhà xe hiển thị ở trang đăng nhập (null = chưa cấu hình → ẩn khối thương hiệu). */
export type Brand = { code: string; name: string; logoUrl: string | null };

export const OPERATOR_CODE = /^[A-Z]{2,4}$/;
export const LOGO_MAX_BYTES = 200 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const logoUrl = (code: string, version: string | null) =>
  version ? `/api/brand/logo/${code}?v=${encodeURIComponent(version)}` : null;
