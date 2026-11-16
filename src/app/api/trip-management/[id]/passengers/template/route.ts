import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { buildImportTemplate } from "@/lib/server/passenger-import";
import { errorResponse, noStore, operatorSession } from "@/lib/server/session";
import { XLSX_TYPE } from "@/lib/staff-booking";
import { tripDetailSchema } from "@/lib/trip-detail";
import { attachmentHeader, manifestTripCode } from "@/lib/trip-passengers";

/** File mẫu trống để nhập khách mới cho chuyến (chỗ trống, điểm đón/trả, danh sách chọn). Không chứa dữ liệu khách. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.create");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    if (new URL(req.url).searchParams.size)
      throw new ApiError(400, "VALIDATION_FAILED", "Tham số không hợp lệ.");
    const detail = tripDetailSchema.parse(
      await backendRequest(
        `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}`,
        { token },
      ),
    );
    const body = await buildImportTemplate(detail, new Date().toISOString());
    const name = `mau-nhap-khach-${manifestTripCode(detail.route.code, detail.trip.departAt)}.xlsx`;
    return new Response(new Uint8Array(body), {
      headers: {
        ...noStore,
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": attachmentHeader(name),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
