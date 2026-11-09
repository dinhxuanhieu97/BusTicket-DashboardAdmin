import { canManageTrips } from "@/lib/trip-management";
import { redirect } from "next/navigation";
import { ownerSession } from "@/lib/server/session";
import { ApiError } from "@/lib/access-policy";
import { AccessFailure } from "@/components/live/auth-forms";
export default async function Page() {
  let access;
  try {
    access = await ownerSession();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
    if (e instanceof ApiError && e.code === "MFA_SETUP_REQUIRED")
      redirect("/mfa");
    return <AccessFailure message="Không đọc được thông tin tài khoản." />;
  }
  const user = access.session.user;
  return (
    <section className="card max-w-2xl p-6">
      <h2 className="text-lg font-bold">Tài khoản PNTicket</h2>
      <dl className="mt-5 divide-y divide-line">
        {[
          ["Số điện thoại", user.phone],
          ["Vai trò", "OWNER · Chủ nhà xe"],
          ["Xác thực hai yếu tố", "Đã bật"],
          ["Phạm vi", "Dữ liệu nhà xe thuộc tài khoản"],
          [
            "Chế độ",
            canManageTrips(
              access.session,
              process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID,
            )
              ? "Quản lý chuyến · Các mục khác chỉ đọc"
              : "Chỉ đọc",
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-4 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        Chưa mở chỉnh sửa hồ sơ, mật khẩu, cấu hình nhà xe hoặc tài khoản nhận
        tiền. Đăng xuất kết thúc phiên trên trình duyệt này; chưa có chức năng
        thu hồi riêng từng token phía backend.
      </p>
    </section>
  );
}
