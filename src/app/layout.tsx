import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { loadBrand } from "@/lib/server/brand";
import { brandPaletteCss } from "@/lib/brand-palette";

const initTheme = `try {
  if (localStorage.getItem("pnticket_live_theme") === "light") {
    document.documentElement.dataset.theme = "light";
  }
  if (localStorage.getItem("pnticket_sidebar_collapsed") === "1") {
    document.documentElement.dataset.sidebar = "collapsed";
  }
} catch {}`;
const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam",
});
/** Biểu tượng mặc định khi nhà xe chưa có logo (đặt trong `public/` để metadata thay được). */
const DEFAULT_ICON = { url: "/icon.svg", type: "image/svg+xml" };

/** Tiêu đề tab và favicon theo nhà xe đã cấu hình; chưa cấu hình thì không hiện tên nào. */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await loadBrand();
  if (!brand)
    return {
      title: "Trang quản trị",
      description: "Quản trị nhà xe",
      icons: { icon: DEFAULT_ICON },
    };
  return {
    title: `Trang quản trị · ${brand.name}`,
    description: `Quản trị ${brand.name}`,
    icons: { icon: brand.logoUrl ? { url: brand.logoUrl } : DEFAULT_ICON },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Màu riêng của nhà xe (cấu hình ở Cài đặt) áp từ lần vẽ đầu để không nháy màu mặc định.
  const colors = (await loadBrand())?.brandColors ?? null;
  return (
    <html
      lang="vi"
      data-theme="dark"
      className={sans.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initTheme }} />
        {colors && (
          <style
            id="pn-brand-palette"
            dangerouslySetInnerHTML={{ __html: brandPaletteCss(colors) }}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
