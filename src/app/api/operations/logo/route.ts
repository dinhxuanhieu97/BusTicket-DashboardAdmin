import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/brand";
import {
  errorResponse,
  json,
  operatorSession,
  protectMutation,
  protectUpload,
} from "@/lib/server/session";

const profile = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  defaultDepartureTime: z.string(),
  logoVersion: z.string().nullable(),
});
const invalid = () =>
  new ApiError(
    400,
    "VALIDATION_FAILED",
    "Logo phải là ảnh PNG, JPEG hoặc WebP, tối đa 200 KB.",
  );

async function logoAccess(request: Request, upload: boolean) {
  if (upload) protectUpload(request, LOGO_TYPES);
  else protectMutation(request);
  if (new URL(request.url).searchParams.size) throw invalid();
  const { token, session } = await operatorSession();
  requirePermission(session, "policy.write");
  return {
    token,
    path: `/api/v1/admin/operators/${session.user.operatorId}/logo`,
  };
}

/** Tải logo: thân request là chính tệp ảnh; API kiểm tra lại chữ ký tệp. */
export async function PUT(request: Request) {
  try {
    const { token, path } = await logoAccess(request, true);
    const type = request.headers.get("content-type")?.split(";")[0]?.trim();
    if (!type || !(LOGO_TYPES as readonly string[]).includes(type))
      throw invalid();
    if (Number(request.headers.get("content-length") || 0) > LOGO_MAX_BYTES)
      throw invalid();
    const data = new Uint8Array(await request.arrayBuffer());
    if (!data.length || data.length > LOGO_MAX_BYTES) throw invalid();
    return json(
      profile.parse(
        await backendRequest(path, {
          token,
          method: "PUT",
          raw: { data, type },
        }),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { token, path } = await logoAccess(request, false);
    return json(
      profile.parse(await backendRequest(path, { token, method: "DELETE" })),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
