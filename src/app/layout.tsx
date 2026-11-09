import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Trang quản trị · PNTicket",
  description: "PNTicket — quản trị nhà xe",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
