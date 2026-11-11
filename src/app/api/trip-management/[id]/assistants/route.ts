import { z } from "zod";
import {
  ApiError,
  hasPermission,
  requirePermission,
} from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";
import {
  assignAssistantsInput,
  assistantCandidatesSchema,
  tripAssistantsSchema,
} from "@/lib/trip-assistants";

type Context = { params: Promise<{ id: string }> };

async function target({ params }: Context) {
  const { token, session } = await operatorSession();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
  const base = `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}`;
  return { token, session, base, path: `${base}/trips/${id}/assistants` };
}

/** Phụ xe đã giao cho chuyến; kèm danh sách có thể chọn khi người xem được phân công. */
export async function GET(_req: Request, context: Context) {
  try {
    const { token, session, base, path } = await target(context);
    requirePermission(session, "trip.read");
    const assigned = tripAssistantsSchema.parse(
      await backendRequest(path, { token }),
    );
    const canAssign = hasPermission(session, "trip.write");
    const candidates = canAssign
      ? assistantCandidatesSchema.parse(
          await backendRequest(`${base}/assistants`, { token }),
        ).assistants
      : [];
    return json({ ...assigned, candidates, canAssign });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Đặt lại danh sách phụ xe của chuyến (OWNER/Điều hành). */
export async function PUT(request: Request, context: Context) {
  try {
    protectMutation(request);
    const { token, session, path } = await target(context);
    requirePermission(session, "trip.write");
    const body = await input(request, assignAssistantsInput);
    return json(
      tripAssistantsSchema.parse(
        await backendRequest(path, { method: "PUT", token, body }),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
