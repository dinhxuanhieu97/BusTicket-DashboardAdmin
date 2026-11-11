import type { Metadata } from "next";
import "./globals.css";
import { loadBrand } from "@/lib/server/brand";

const initTheme = `try {
  if (localStorage.getItem("pnticket_live_theme") === "light") {
    document.documentElement.dataset.theme = "light";
  }
} catch {}`;
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
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
