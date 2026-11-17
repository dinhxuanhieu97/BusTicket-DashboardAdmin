import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { readPassengerWorkbook } from "@/lib/server/passenger-import";
import {
  errorResponse,
  json,
  operatorSession,
  protectUpload,
} from "@/lib/server/session";
import {
  IMPORT_MAX_BYTES,
  XLSX_TYPE,
  importOptions,
  importPreviewSchema,
  importResultSchema,
} from "@/lib/staff-booking";

/**
 * Nhập khách mới từ file Excel (`booking.create`). Thân request là chính tệp .xlsx; tùy chọn qua query:
 * `dryRun` (mặc định true: xem trước), `confirm` (xác nhận ngay hay giữ chỗ chờ chuyển khoản), `notify`, `name`.
 * Dashboard đọc file rồi gửi các dòng không có Mã vé cho API; API kiểm tra lại và ghi tất cả hoặc không ghi gì.
 * Idempotency-Key = SHA-256 của nội dung gửi đi: gửi lại đúng file đó không tạo đơn trùng.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    protectUpload(req, [XLSX_TYPE]);
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.create");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const opts = importOptions.safeParse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    if (!opts.success)
      throw new ApiError(400, "VALIDATION_FAILED", "Tham số không hợp lệ.");
    if (Number(req.headers.get("content-length") || 0) > IMPORT_MAX_BYTES)
      throw new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Tệp quá lớn (tối đa 2 MB).",
      );
    const data = new Uint8Array(await req.arrayBuffer());
    const { rows, existingRows } = await readPassengerWorkbook(data);
    const file = { existingRows, newRows: rows.length };
    if (!rows.length)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        existingRows
          ? "File chưa có dòng khách mới. Dòng có Mã vé là khách đã có đơn; cập nhật lên xe/thực thu sẽ có ở bản sau."
          : "File chưa có dòng khách nào.",
      );
    const body = {
      ...(opts.data.name ? { fileName: opts.data.name.slice(0, 200) } : {}),
      confirm: opts.data.confirm === "true",
      notifyCustomer: opts.data.notify === "true",
      rows,
    };
    const dryRun = opts.data.dryRun === "true";
    const path = `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}/passengers/import`;
    const raw = await backendRequest(path + (dryRun ? "?dryRun=true" : ""), {
      token,
      method: "POST",
      body,
      ...(dryRun
        ? {}
        : {
            idempotencyKey: createHash("sha256")
              .update(
                JSON.stringify([
                  id,
                  body.confirm,
                  body.notifyCustomer,
                  body.rows,
                ]),
              )
              .digest("hex"),
          }),
    });
    return json({
      ...(dryRun
        ? importPreviewSchema.parse(raw)
        : importResultSchema.parse(raw)),
      file,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
