import { z } from "zod";
import { ApiError } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { staffUserSchema } from "@/lib/live-contracts";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";
import { rejectStaffQuery, staffAccess } from "../access";
import { updateStaffInput } from "../contracts";

type Context = { params: Promise<{ userId: string }> };
const idSchema = z.uuid();
const deleteResponse = z.object({ ok: z.literal(true) });

async function staffTarget(request: Request, { params }: Context) {
  protectMutation(request);
  const { path, token, viewerId } = await staffAccess();
  rejectStaffQuery(request);
  const id = idSchema.safeParse((await params).userId);
  if (!id.success) {
    throw new ApiError(400, "VALIDATION_FAILED", "Mã nhân viên không hợp lệ.");
  }
  return {
    path: `${path}/${id.data}`,
    token,
    isViewer: id.data.toLowerCase() === viewerId.toLowerCase(),
  };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { path, token, isViewer } = await staffTarget(request, context);
    const body = await input(request, updateStaffInput);
    if (isViewer && body.status === "DISABLED") {
      throw new ApiError(403, "FORBIDDEN", "Bạn không thể tự khóa tài khoản.");
    }
    const result = await backendRequest(path, { method: "PATCH", token, body });
    return json(staffUserSchema.parse(result));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { path, token, isViewer } = await staffTarget(request, context);
    if (isViewer) {
      throw new ApiError(403, "FORBIDDEN", "Bạn không thể tự xóa tài khoản.");
    }
    const result = await backendRequest(path, { method: "DELETE", token });
    return json(deleteResponse.parse(result));
  } catch (error) {
    return errorResponse(error);
  }
}
