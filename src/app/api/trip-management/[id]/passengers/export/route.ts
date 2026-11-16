import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { buildManifestWorkbook } from "@/lib/server/passenger-export";
import { errorResponse, noStore, operatorSession } from "@/lib/server/session";
import { tripAssistantsSchema } from "@/lib/trip-assistants";
import { tripDetailSchema } from "@/lib/trip-detail";
import {
  MANIFEST_COLUMNS,
  adminTripPassengersSchema,
  attachmentHeader,
  exportFormatSchema,
  manifestRows,
  manifestTripCode,
  passengerScopeSchema,
  toCsv,
} from "@/lib/trip-passengers";

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Xuất danh sách khách của chuyến ra Excel (theo mẫu nhà xe) hoặc CSV. Cần `booking.export`;
 * API ghi nhật ký mỗi lần xuất. File không lưu lại trên máy chủ.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.export");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const search = new URL(req.url).searchParams;
    const format = exportFormatSchema.safeParse(search.get("format") ?? "xlsx");
    const status = passengerScopeSchema.safeParse(
      search.get("status") ?? "active",
    );
    if (!format.success || !status.success)
      throw new ApiError(400, "VALIDATION_FAILED", "Định dạng không hợp lệ.");
    const base = `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}`;
    const [detailRaw, passengersRaw, assistantsRaw] = await Promise.all([
      backendRequest(base, { token }),
      backendRequest(
        `${base}/passengers/export?status=${status.data}&format=${format.data}`,
        { token },
      ),
      backendRequest(`${base}/assistants`, { token }),
    ]);
    const detail = tripDetailSchema.parse(detailRaw);
    const passengers = adminTripPassengersSchema.parse(passengersRaw);
    const { assistants } = tripAssistantsSchema.parse(assistantsRaw);
    const name = `danh-sach-khach-${manifestTripCode(detail.route.code, detail.trip.departAt)}.${format.data}`;
    const body =
      format.data === "csv"
        ? toCsv(MANIFEST_COLUMNS, manifestRows(passengers, detail))
        : await buildManifestWorkbook({
            detail,
            passengers,
            assistants,
            exportedAt: passengers.fetchedAt,
          });
    return new Response(
      typeof body === "string" ? body : new Uint8Array(body),
      {
        headers: {
          ...noStore,
          "Content-Type":
            format.data === "csv" ? "text/csv; charset=utf-8" : XLSX,
          "Content-Disposition": attachmentHeader(name),
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
