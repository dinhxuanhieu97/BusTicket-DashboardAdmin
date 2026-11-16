import "server-only";
import ExcelJS from "exceljs";
import { ApiError } from "@/lib/access-policy";
import { IMPORT_MAX_BYTES, MAX_IMPORT_ROWS } from "@/lib/staff-booking";
import { stopTime, type TripDetail } from "@/lib/trip-detail";
import {
  MANIFEST_COLUMNS,
  manifestTripCode,
  vnDate,
  vnTime,
} from "@/lib/trip-passengers";

type Cell = string | number | null;
export interface ImportRow {
  row: number;
  seatCode: Cell;
  contactName: Cell;
  contactPhone: Cell;
  occupancy: Cell;
  infantCount: Cell;
  pickupStop: Cell;
  dropoffStop: Cell;
  paidAmount: Cell;
  totalAmount: Cell;
  note: Cell;
}

const SHEET = "DanhSachKhach";
/** Số dòng tối đa đọc trong sheet (kể cả dòng trống/dòng có mã vé) để chặn file bất thường. */
const MAX_SHEET_ROWS = 2000;
/** Thân JSON gửi API phải dưới giới hạn mặc định 100 KB của API. */
const MAX_PAYLOAD_BYTES = 90_000;

const FIELD_BY_HEADER: Record<string, keyof Omit<ImportRow, "row"> | "code"> = {
  "Mã vé": "code",
  "Phòng/Chỗ": "seatCode",
  "Số người": "occupancy",
  "Trẻ <2 tuổi": "infantCount",
  "Họ tên khách": "contactName",
  SĐT: "contactPhone",
  "Điểm đón": "pickupStop",
  "Điểm trả": "dropoffStop",
  "Tổng tiền": "totalAmount",
  "Đã trả": "paidAmount",
  "Ghi chú": "note",
};
const REQUIRED = ["Phòng/Chỗ", "Họ tên khách", "SĐT"];

const bad = (message: string) =>
  new ApiError(400, "VALIDATION_FAILED", message);
const normHeader = (s: string) =>
  s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Giá trị ô: kết quả công thức, chữ của rich text/link; ngày giờ và lỗi công thức coi như không đọc được. */
export function cellValue(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return null;
  if (typeof value === "object") {
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
    if ("richText" in value)
      return value.richText
        .map((r) => r.text)
        .join("")
        .slice(0, 500);
    if ("text" in value && typeof value.text === "string")
      return value.text.slice(0, 500);
    if ("error" in value) return null;
  }
  return null;
}

const isBlank = (v: Cell) =>
  v === null || (typeof v === "string" && v.trim() === "");

/** "Nguyễn Văn A (+1)" (file xuất ghi số khách đi cùng) → "Nguyễn Văn A". */
export const stripCompanions = (name: Cell): Cell =>
  typeof name === "string" ? name.replace(/\s*\(\+\d+\)\s*$/, "") : name;

/**
 * Đọc sheet `DanhSachKhach` (cùng cột với file xuất). Dòng có Mã vé là khách đã có đơn: chỉ đếm, cập nhật lên xe/thực
 * thu làm ở D3. Dòng trống bị bỏ qua. Không ghi gì; API kiểm tra lại toàn bộ.
 */
export async function readPassengerWorkbook(data: Uint8Array) {
  if (!data.length) throw bad("Chưa chọn tệp.");
  if (data.length > IMPORT_MAX_BYTES) throw bad("Tệp quá lớn (tối đa 2 MB).");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw bad(
      "Không đọc được tệp. Hãy lưu lại dạng Excel (.xlsx) rồi thử lại.",
    );
  }
  const sheet =
    wb.getWorksheet(SHEET) ??
    wb.worksheets.find((ws) =>
      REQUIRED.every((h) =>
        (ws.getRow(1).values as ExcelJS.CellValue[])
          .map((v) => normHeader(String(cellValue(v) ?? "")))
          .includes(normHeader(h)),
      ),
    );
  if (!sheet)
    throw bad(`Không thấy sheet "${SHEET}". Hãy dùng file mẫu của chuyến.`);
  if (sheet.actualRowCount > MAX_SHEET_ROWS)
    throw bad(`Sheet có quá nhiều dòng (tối đa ${MAX_SHEET_ROWS}).`);

  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const label = normHeader(String(cellValue(cell.value) ?? ""));
    const header = Object.keys(FIELD_BY_HEADER).find(
      (h) => normHeader(h) === label,
    );
    if (header && !columns.has(header)) columns.set(header, col);
  });
  const missing = REQUIRED.filter((h) => !columns.has(h));
  if (missing.length)
    throw bad(`Dòng tiêu đề thiếu cột: ${missing.join(", ")}.`);

  const rows: ImportRow[] = [];
  let existingRows = 0;
  sheet.eachRow({ includeEmpty: false }, (r, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (header: string) => {
      const col = columns.get(header);
      return col ? cellValue(r.getCell(col).value) : null;
    };
    const values = Object.fromEntries(
      Object.entries(FIELD_BY_HEADER).map(([h, field]) => [field, get(h)]),
    ) as Record<string, Cell>;
    const { code, ...fields } = values;
    if (Object.values(fields).every(isBlank) && isBlank(code ?? null)) return;
    if (!isBlank(code ?? null)) {
      existingRows += 1;
      return;
    }
    rows.push({
      row: rowNumber,
      seatCode: fields.seatCode ?? null,
      contactName: stripCompanions(fields.contactName ?? null),
      contactPhone: fields.contactPhone ?? null,
      occupancy: fields.occupancy ?? null,
      infantCount: fields.infantCount ?? null,
      pickupStop: fields.pickupStop ?? null,
      dropoffStop: fields.dropoffStop ?? null,
      paidAmount: fields.paidAmount ?? null,
      totalAmount: fields.totalAmount ?? null,
      note: fields.note ?? null,
    });
  });
  if (rows.length > MAX_IMPORT_ROWS)
    throw bad(
      `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng khách mới (file có ${rows.length}).`,
    );
  if (JSON.stringify(rows).length > MAX_PAYLOAD_BYTES)
    throw bad("Nội dung file quá dài. Hãy chia thành nhiều file nhỏ hơn.");
  return { rows, existingRows };
}

const TEMPLATE_GUIDE = [
  "HƯỚNG DẪN NHẬP KHÁCH MỚI",
  "1. Mỗi dòng là một chỗ. Khách đặt nhiều chỗ: ghi cùng Họ tên và SĐT trên nhiều dòng — hệ thống gộp thành một đơn.",
  "2. Bắt buộc: Phòng/Chỗ, Họ tên khách, SĐT. Để trống cột Mã vé (hệ thống tự cấp mã khi ghi).",
  "3. Phòng/Chỗ, Điểm đón, Điểm trả chọn từ danh sách (sheet ChoTrong, DiemDonTra). Số người: 1 hoặc 2 nếu phòng đôi.",
  "4. Đã trả: tiền khách đã đưa (tiền mặt). Tổng tiền tính theo bảng giá của hệ thống; số trong file chỉ để đối chiếu.",
  "5. Danh sách chỗ trống là lúc tải file. Hệ thống kiểm tra lại khi ghi: nếu có chỗ vừa được đặt, không dòng nào được ghi.",
  "6. File có số điện thoại khách: không chia sẻ ra ngoài, xóa khỏi máy sau khi nhập xong.",
];

const TEMPLATE_WIDTHS = [
  6, 12, 10, 14, 9, 10, 26, 14, 24, 12, 20, 13, 13, 13, 32, 11, 14,
];
const BLANK_ROWS = MAX_IMPORT_ROWS;

/**
 * File mẫu trống của chuyến: sheet DanhSachKhach (cùng cột với file xuất, có danh sách chọn), ChoTrong (chỗ còn trống
 * lúc tải, giá), DiemDonTra (điểm của chuyến), HuongDan. Không có dữ liệu khách.
 */
export async function buildImportTemplate(detail: TripDetail, at: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PNTicket";
  wb.created = new Date(at);

  const list = wb.addWorksheet(SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
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
  TEMPLATE_WIDTHS.forEach((w, i) => (list.getColumn(i + 1).width = w));
  for (const c of [12, 13, 14, 17]) list.getColumn(c).numFmt = "#,##0";
  for (const c of [2, 3, 8]) list.getColumn(c).numFmt = "@";

  const fareOf = (floor: string, occupancy: number) =>
    detail.fares.find((f) => f.floor === floor && f.occupancy === occupancy)
      ?.price ?? null;
  const free = detail.seats.filter(
    (s) => s.sellable && s.status === "AVAILABLE",
  );
  const seats = wb.addWorksheet("ChoTrong");
  seats.columns = [
    { header: "Phòng/Chỗ", width: 12 },
    { header: "Tầng", width: 14 },
    { header: "Tối đa người", width: 13 },
    { header: "Giá 1 người", width: 14 },
    { header: "Giá 2 người", width: 14 },
  ];
  seats.getRow(1).font = { bold: true };
  for (const s of free) {
    const floor =
      detail.layout.floors.find((f) => f.code === s.floor)?.label ?? s.floor;
    seats.addRow([
      s.code,
      floor,
      s.maxOccupancy,
      fareOf(s.floor, 1),
      s.maxOccupancy > 1 ? fareOf(s.floor, 2) : null,
    ]);
  }
  for (const c of [4, 5]) seats.getColumn(c).numFmt = "#,##0";
  seats.addRow([]);
  seats.addRow([
    `Chỗ trống lúc ${vnTime(at)} ${vnDate(at)} — có thể thay đổi; hệ thống kiểm tra lại khi ghi.`,
  ]).font = { italic: true };

  const stops = wb.addWorksheet("DiemDonTra");
  stops.columns = [
    { header: "Điểm đón", width: 30 },
    { header: "Giờ đón dự kiến", width: 16 },
    { header: "Điểm trả", width: 30 },
    { header: "Giờ trả dự kiến", width: 16 },
  ];
  stops.getRow(1).font = { bold: true };
  const { pickup, dropoff } = detail.stops;
  for (let i = 0; i < Math.max(pickup.length, dropoff.length); i++) {
    const p = pickup[i],
      d = dropoff[i];
    stops.addRow([
      p?.name ?? null,
      p ? stopTime(p) : null,
      d?.name ?? null,
      d ? stopTime(d) : null,
    ]);
  }

  const listRule = (formula: string): ExcelJS.DataValidation => ({
    type: "list",
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "Giá trị ngoài danh sách",
    error:
      "Chọn giá trị trong danh sách. Hệ thống sẽ báo lỗi dòng này khi kiểm tra.",
  });
  const seatRule = free.length
    ? listRule(`ChoTrong!$A$2:$A$${free.length + 1}`)
    : null;
  const pickupRule = pickup.length
    ? listRule(`DiemDonTra!$A$2:$A$${pickup.length + 1}`)
    : null;
  const dropoffRule = dropoff.length
    ? listRule(`DiemDonTra!$C$2:$C$${dropoff.length + 1}`)
    : null;
  const occupancyRule: ExcelJS.DataValidation = {
    type: "whole",
    operator: "between",
    allowBlank: true,
    formulae: [1, 2],
    showErrorMessage: true,
    error: "Số người là 1 hoặc 2.",
  };
  for (let r = 2; r <= BLANK_ROWS + 1; r++) {
    const row = list.getRow(r);
    if (seatRule) row.getCell(3).dataValidation = seatRule;
    row.getCell(5).dataValidation = occupancyRule;
    if (pickupRule) row.getCell(9).dataValidation = pickupRule;
    if (dropoffRule) row.getCell(11).dataValidation = dropoffRule;
  }

  const info = wb.addWorksheet("HuongDan");
  info.getColumn(1).width = 110;
  const v = detail.vehicle;
  [
    ...TEMPLATE_GUIDE,
    "",
    `Chuyến: ${manifestTripCode(detail.route.code, detail.trip.departAt)} · ${detail.trip.name}`,
    `Tuyến: ${detail.route.origin} → ${detail.route.destination} · xuất bến ${vnTime(detail.trip.departAt)} ${vnDate(detail.trip.departAt)}`,
    `Xe: ${v.code} · ${v.name} · ${detail.layout.name}`,
  ].forEach((line, i) => {
    const row = info.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 13 };
    row.alignment = { wrapText: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
