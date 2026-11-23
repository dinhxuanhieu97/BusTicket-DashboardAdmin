/**
 * Màu giao diện Dashboard theo nhà xe: hai màu của dải chuyển (góc trên trái → góc dưới phải, giống favicon).
 * Từ hai màu đó suy ra token cho cả theme tối và sáng, giữ chữ/nút đủ tương phản (WCAG AA ≥ 4.5:1)
 * dù admin chọn màu nào. Hàm thuần, dùng cả ở server (layout) lẫn client (áp ngay sau khi lưu).
 */

export type BrandColors = { from: string; to: string };

/** Mặc định: tím chàm → xanh lơ, cùng màu với `public/icon.svg`. */
export const DEFAULT_BRAND_COLORS: BrandColors = {
  from: "#6366f1",
  to: "#06b6d4",
};

/** Gợi ý nhanh trong Cài đặt (mục đầu là mặc định). */
export const BRAND_PRESETS: { name: string; colors: BrandColors }[] = [
  { name: "Chàm – lơ (mặc định)", colors: DEFAULT_BRAND_COLORS },
  { name: "Ngọc", colors: { from: "#14b8a6", to: "#22c55e" } },
  { name: "Hoàng hôn", colors: { from: "#f97316", to: "#ec4899" } },
  { name: "Đại dương", colors: { from: "#2563eb", to: "#06b6d4" } },
  { name: "Tím hồng", colors: { from: "#8b5cf6", to: "#ec4899" } },
  { name: "Đỏ son", colors: { from: "#dc2626", to: "#f59e0b" } },
];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: Rgb) =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Trộn `a` về phía `b` một tỉ lệ `t` (0 = giữ `a`, 1 = thành `b`). */
export function mix(a: string, b: string, t: number) {
  const x = toRgb(a),
    y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Tỉ lệ tương phản WCAG giữa hai màu (1–21). */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Đẩy `color` dần về `towards` (trắng/đen) tới khi tương phản ≥ `min` với mọi nền trong `backgrounds`. */
function readableOn(
  color: string,
  backgrounds: string[],
  towards: string,
  min = 4.5,
) {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(color, towards, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return towards;
}

const rgba = (hex: string, alpha: number) =>
  `rgb(${toRgb(hex).join(" ")} / ${alpha})`;

/** Nền đặc của hai theme (khớp `globals.css`): chữ accent phải đọc được trên cả nền trang, thẻ và ô nhập. */
const DARK_BACKGROUNDS = ["#17191a", "#262828", "#2f3131", "#383a3a"];
const LIGHT_BACKGROUNDS = ["#efebe4", "#fbfaf7", "#f2efe9", "#e9e5dd"];

export type PaletteTokens = Record<string, string>;

/** Token CSS của một theme suy ra từ hai màu thương hiệu. */
export function brandPalette(colors: BrandColors) {
  const from = colors.from.toLowerCase(),
    to = colors.to.toLowerCase();
  const gradient = `linear-gradient(135deg, ${from}, ${to})`;
  // Nút chính: cùng dải màu nhưng hai đầu đậm vừa đủ để chữ trắng đạt AA ở mọi điểm của dải, dùng chung hai theme.
  const deepFrom = readableOn(from, ["#ffffff"], "#000000"),
    deepTo = readableOn(to, ["#ffffff"], "#000000");
  const button: PaletteTokens = {
    "--primary-gradient": `linear-gradient(135deg, ${deepFrom}, ${deepTo})`,
    "--primary-gradient-hover": `linear-gradient(135deg, ${mix(deepFrom, "#000000", 0.12)}, ${mix(deepTo, "#000000", 0.12)})`,
    "--on-primary-gradient": "#ffffff",
  };

  // Theme tối: accent sáng lên cho đọc được trên nền tối; chữ trên nút dùng màu đậm cùng sắc.
  const darkAccent = readableOn(from, DARK_BACKGROUNDS, "#ffffff");
  const darkOnPrimary = readableOn(
    mix(from, "#000000", 0.75),
    [darkAccent],
    "#000000",
  );
  const dark: PaletteTokens = {
    "--brand-from": from,
    "--brand-to": to,
    "--brand-gradient": gradient,
    "--accent": darkAccent,
    "--primary": darkAccent,
    "--primary-hover": mix(darkAccent, "#ffffff", 0.18),
    "--on-primary": darkOnPrimary,
    "--accent-glow": rgba(darkAccent, 0.14),
    "--bg-glow-1": rgba(from, 0.2),
    "--bg-glow-2": rgba(to, 0.14),
    ...button,
  };

  // Theme sáng: accent đậm lại cho đọc được trên nền sáng; nút dùng chữ trắng.
  const lightAccent = readableOn(from, LIGHT_BACKGROUNDS, "#000000");
  const lightPrimary = readableOn(lightAccent, ["#ffffff"], "#000000");
  const light: PaletteTokens = {
    "--brand-from": from,
    "--brand-to": to,
    "--brand-gradient": gradient,
    "--accent": lightAccent,
    "--primary": lightPrimary,
    "--primary-hover": mix(lightPrimary, "#000000", 0.18),
    "--on-primary": "#ffffff",
    "--accent-glow": rgba(lightAccent, 0.13),
    "--bg-glow-1": rgba(from, 0.18),
    "--bg-glow-2": rgba(to, 0.16),
    ...button,
  };
  return { dark, light };
}

const block = (selector: string, tokens: PaletteTokens) =>
  `${selector}{${Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;

/**
 * CSS ghi đè token mặc định của `globals.css`. Selector có độ ưu tiên cao hơn `:root` và
 * `html[data-theme="light"]` nên thắng bất kể thứ tự nạp. Chỉ nhận màu hex đã kiểm tra (không chèn được CSS lạ).
 */
export function brandPaletteCss(colors: BrandColors | null | undefined) {
  const c =
    colors && HEX_COLOR.test(colors.from) && HEX_COLOR.test(colors.to)
      ? colors
      : DEFAULT_BRAND_COLORS;
  const { dark, light } = brandPalette(c);
  return (
    block("html:root", dark) + block('html[data-theme="light"]:root', light)
  );
}

/** id thẻ `<style>` client ghi đè sau khi đăng nhập/lưu màu (đứng sau thẻ của server nên thắng). */
export const LIVE_PALETTE_ID = "pn-brand-palette-live";

/** Áp màu của nhà xe đang đăng nhập ngay trên trang (null = màu mặc định). */
export function applyBrandPalette(colors: BrandColors | null | undefined) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(LIVE_PALETTE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = LIVE_PALETTE_ID;
    document.head.appendChild(el);
  }
  el.textContent = brandPaletteCss(colors);
}
