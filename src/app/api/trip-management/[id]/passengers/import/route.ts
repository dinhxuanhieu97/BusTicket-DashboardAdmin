import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { boardingPlanSchema } from "@/lib/passenger-ops";
import { readPassengerWorkbook } from "@/lib/server/passenger-import";
import {
  errorResponse,
  json,
  operatorSession,
  protectUpload,
} from "@/lib/server/session";
import {
  EMPTY_IMPORT_PREVIEW,
  IMPORT_MAX_BYTES,
  XLSX_TYPE,
  importOptions,
  importPreviewSchema,
  importResultSchema,
} from "@/lib/staff-booking";

const keyOf = (parts: unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

/**
 * Nhập file danh sách khách. Thân request là chính tệp .xlsx; tùy chọn qua query: `dryRun` (mặc định true: xem trước),
 * `confirm` (đơn mới xác nhận ngay hay giữ chỗ), `notify`, `name`.
 * - Dòng không có Mã vé → khách mới (`booking.create`, API `passengers/import`).
 * - Dòng có Mã vé → cập nhật Đã lên xe / Thực thu trên xe (`booking.board`, API `passengers/boarding-import`).
 * Mỗi phần ghi tất cả hoặc không ghi gì; Idempotency-Key = SHA-256 nội dung gửi đi nên gửi lại cùng file không ghi trùng.
 * Ghi khách mới trước, cập nhật sau: nếu phần sau lỗi, sửa file rồi gửi lại — phần đã ghi được nhận ra và bỏ qua.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    protectUpload(req, [XLSX_TYPE]);
    const { token, session } = await operatorSession();
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
    const { rows, updates } = await readPassengerWorkbook(data);
    const file = { existingRows: updates.length, newRows: rows.length };
    if (!rows.length && !updates.length)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "File chưa có dòng khách nào.",
      );
    if (rows.length) requirePermission(session, "booking.create");
    if (updates.length) requirePermission(session, "booking.board");

    const dryRun = opts.data.dryRun === "true";
    const tripPath = `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}/passengers`;
    const q = dryRun ? "?dryRun=true" : "";
    const fileName = opts.data.name
      ? { fileName: opts.data.name.slice(0, 200) }
      : {};

    let created: unknown = null;
    if (rows.length) {
      const body = {
        ...fileName,
        confirm: opts.data.confirm === "true",
        notifyCustomer: opts.data.notify === "true",
        rows,
      };
      created = await backendRequest(`${tripPath}/import${q}`, {
        token,
        method: "POST",
        body,
        ...(dryRun
          ? {}
          : {
              idempotencyKey: keyOf([
                id,
                body.confirm,
                body.notifyCustomer,
                body.rows,
              ]),
            }),
      });
    }
    const boarding = updates.length
      ? boardingPlanSchema.parse(
          await backendRequest(`${tripPath}/boarding-import${q}`, {
            token,
            method: "POST",
            body: { ...fileName, rows: updates },
            ...(dryRun
              ? {}
              : { idempotencyKey: keyOf([id, "boarding", updates]) }),
          }),
        )
      : null;

    if (dryRun) {
      const preview = created
        ? importPreviewSchema.parse(created)
        : EMPTY_IMPORT_PREVIEW;
      return json({
        ...preview,
        ok: preview.ok && (boarding?.ok ?? true),
        boarding,
        file,
      });
    }
    return json({
      ...(created
        ? importResultSchema.parse(created)
        : { bookings: [], replayed: false }),
      boarding,
      file,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
