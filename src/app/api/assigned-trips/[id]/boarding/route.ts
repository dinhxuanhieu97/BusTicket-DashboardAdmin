import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { boardingInput, boardingResultSchema } from "@/lib/passenger-ops";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

/** Phụ xe quét vé / gõ mã vé để đánh dấu lên xe trên chuyến được giao (`trip.assigned.board`); chuyến khác trả 404. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    protectMutation(req);
    const { token, session } = await operatorSession();
    requirePermission(session, "trip.assigned.board");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const body = await input(req, boardingInput);
    return json(
      boardingResultSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/my-trips/${id}/boarding`,
          { token, method: "POST", body },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
