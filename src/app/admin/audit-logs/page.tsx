import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/server/page-access";

/** Nhật ký đã chuyển vào Cài đặt; giữ đường dẫn cũ để bookmark và liên kết còn dùng được. */
export default async function Page() {
  if (!(await requirePagePermission("audit.read"))) return null;
  redirect("/admin/settings?tab=audit");
}
