import { z } from "zod";
import { tripManager } from "@/lib/server/trip-management";
import {
  json,
  errorResponse,
  protectMutation,
  input,
} from "@/lib/server/session";
import { statusInput, tripWriteResult } from "@/lib/trip-management";
import { backendRequest } from "@/lib/backend-client";
import { ApiError } from "@/lib/access-policy";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    protectMutation(req);
    const { base, token } = await tripManager();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const body = await input(req, statusInput);
    return json({
      trip: tripWriteResult.parse(
        await backendRequest(base + "/trips/" + id + "/status", {
          token,
          method: "PATCH",
          body,
        }),
      ),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
