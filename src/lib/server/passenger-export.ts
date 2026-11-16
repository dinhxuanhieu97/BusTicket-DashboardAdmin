import "server-only";
import ExcelJS from "exceljs";
import type { TripDetail } from "@/lib/trip-detail";
import type { AssistantRef } from "@/lib/trip-assistants";
import {
  MANIFEST_COLUMNS,
  manifestRows,
  manifestTripCode,
  vnDate,
  vnTime,
  type AdminTripPassengers,
} from "@/lib/trip-passengers";

const GUIDE = [
  "HƯỚNG DẪN SỬ DỤNG",
  "1. File này do hệ thống xuất cho từng chuyến. Phụ xe dùng để gọi khách, đón khách và thu tiền còn lại.",
  "2. Cột 'Trẻ <2 tuổi' là số bé nằm chung miễn phí theo chính sách nhà xe (không tính vào số người của phòng).",
  "3. Cột 'Đã lên xe' và 'Thực thu trên xe' do phụ xe điền nếu không dùng app quét QR.",
  "4. Cuối chuyến, nộp file/biên bản cho kế toán để lập phiếu bàn giao tiền mặt.",
  "5. KHÔNG dùng file này để bán thêm vé: vé chỉ được bán qua hệ thống để tránh trùng chỗ.",
  "6. File có số điện thoại khách: không chia sẻ ra ngoài, xóa khỏi máy sau khi hoàn thành chuyến.",
  "7. Tiền của đơn nhiều chỗ chỉ ghi ở dòng đầu tiên của đơn. Đơn đang giữ chỗ (chưa trả đủ cọc) được ghi ở cột Ghi chú.",
];

const MONEY_COLUMNS = [12, 13, 14, 17];
const WIDTHS = [
  6, 12, 10, 14, 9, 10, 26, 14, 24, 12, 20, 13, 13, 13, 32, 11, 14,
];

/** File Excel theo mẫu `mau-danh-sach-khach-theo-chuyen.xlsx`: sheet Chuyen, DanhSachKhach, HuongDan. */
export async function buildManifestWorkbook(input: {
  detail: TripDetail;
  passengers: AdminTripPassengers;
  assistants: readonly AssistantRef[];
  exportedAt: string;
}) {
  const { detail, passengers, assistants, exportedAt } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PNTicket";
  wb.created = new Date(exportedAt);

  const info = wb.addWorksheet("Chuyen");
  info.getColumn(1).width = 28;
  info.getColumn(2).width = 60;
  info.addRow(["THÔNG TIN CHUYẾN"]).font = { bold: true, size: 13 };
  const v = detail.vehicle;
  const pairs: [string, string][] = [
    ["Mã chuyến", manifestTripCode(detail.route.code, detail.trip.departAt)],
    ["Tên chuyến", detail.trip.name],
    [
      "Tuyến",
      `${detail.route.code} · ${detail.route.origin} → ${detail.route.destination}`,
    ],
    ["Ngày khởi hành", vnDate(detail.trip.departAt)],
    ["Giờ khởi hành", vnTime(detail.trip.departAt)],
    ["Xe", `${v.code} · ${v.name} · ${detail.layout.name}`],
    ["Biển số", v.plateNumber ?? ""],
    ["Tài xế", ""],
    ["Phụ xe giám sát", assistants.map((a) => a.fullName).join(", ")],
    ["SĐT liên hệ của chuyến", detail.trip.contactPhone ?? ""],
    [
      "Xuất lúc",
      `${vnDate(exportedAt)} ${vnTime(exportedAt)} — danh sách có thể thay đổi sau thời điểm này`,
    ],
    [
      "Tổng",
      `${passengers.summary.bookings} đơn đã xác nhận · ${passengers.summary.people} khách · ${passengers.summary.seats} chỗ` +
        (passengers.holding.bookings
          ? ` · ${passengers.holding.bookings} đơn đang giữ chỗ`
          : ""),
    ],
  ];
  for (const [k, value] of pairs) {
    const row = info.addRow([k, value]);
    row.getCell(1).font = { bold: true };
  }

  const list = wb.addWorksheet("DanhSachKhach", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:1",
    },
  });
  const header = list.addRow([...MANIFEST_COLUMNS]);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  header.eachCell((c) => {
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF3F8" },
    };
    c.border = { bottom: { style: "thin" } };
  });
  WIDTHS.forEach((w, i) => (list.getColumn(i + 1).width = w));
  for (const c of MONEY_COLUMNS) list.getColumn(c).numFmt = "#,##0";
  // Ô chữ (mã vé, SĐT) giữ dạng văn bản để Excel không bỏ số 0 đầu hay đổi thành số.
  for (const c of [2, 3, 8]) list.getColumn(c).numFmt = "@";
  for (const r of manifestRows(passengers, detail)) list.addRow(r);
  list.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: MANIFEST_COLUMNS.length },
  };

  const guide = wb.addWorksheet("HuongDan");
  guide.getColumn(1).width = 110;
  GUIDE.forEach((line, i) => {
    const row = guide.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 13 };
    row.alignment = { wrapText: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
