import type { NavKey } from "./nav";

/** Hướng dẫn ngắn cho từng mục menu; trang Trợ giúp chỉ hiện mục người dùng được thấy. */
export const HELP: Record<NavKey, string> = {
  assigned:
    "Các chuyến điều hành giao cho bạn. Mở chuyến để soát vé, xem danh sách khách và thu tiền còn thiếu.",
  overview:
    "Tình hình hôm nay: số chuyến, chỗ đã bán, tiền thu, khoản cần đối soát và độ lấp đầy theo ngày hoặc 7 ngày.",
  trips:
    "Lịch chạy theo ngày, tháng, năm. Chuyển Bảng/Thẻ, lọc theo tuyến, mở hoặc đóng bán và thêm chuyến mới.",
  seats:
    "Chọn ngày và chuyến, bấm vào một chỗ để xem trạng thái, mã đơn, thời gian giữ và bán tại quầy.",
  passengers:
    "Danh sách khách theo chuyến: soát vé, sửa đơn, hủy, thu tiền và xuất Excel theo mẫu nhà xe.",
  schedules:
    "Lịch tự động sinh chuyến cho 30 ngày tới; hai xe đổi chiều mỗi ngày từ ngày bắt đầu.",
  fleet: "Thêm, sửa, tạm ngừng xe. Chỉ xe Đang chạy được chọn khi tạo chuyến.",
  routes: "Tuyến theo cặp đi/về, điểm đón và điểm trả hiển thị trên Mini App.",
  payments:
    "Sổ thu: mọi khoản tiền đã nhận. Lọc theo trạng thái kiểm tra, xử lý khoản cần đối soát và khoản cần hoàn.",
  revenue:
    "Doanh thu 7 hoặc 30 ngày so với kỳ trước, theo phương thức thanh toán và giờ thu nhiều nhất.",
  users:
    "Thêm nhân viên, đổi vai trò, khóa hoặc mở lại tài khoản và đặt lại mật khẩu.",
  settings:
    "Thông tin tài khoản, đổi mật khẩu, xác thực hai lớp và thông tin chung của nhà xe.",
  help: "Trang này.",
};

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Mở Tìm nhanh (Windows: Ctrl + K)" },
  { keys: ["["], label: "Thu gọn hoặc mở rộng thanh bên" },
  { keys: ["↑", "↓", "Enter"], label: "Chọn trang trong Tìm nhanh" },
  { keys: ["Esc"], label: "Đóng hộp thoại" },
];
