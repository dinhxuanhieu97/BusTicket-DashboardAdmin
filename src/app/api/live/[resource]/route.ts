import { ownerSession, json, errorResponse } from "@/lib/server/session";
import { backendRequest } from "@/lib/backend-client";
import { ApiError, readPath } from "@/lib/access-policy";
import { resourceSchemas, type Resource } from "@/lib/live-contracts";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    if (!Object.hasOwn(resourceSchemas, resource))
      throw new ApiError(404, "NOT_FOUND", "Không tìm thấy dữ liệu.");
    const { token, session } = await ownerSession();
    const path = readPath(
      resource as Resource,
      session.user.operatorId!,
      new URL(req.url).searchParams,
    );
    const payload = resourceSchemas[resource as Resource].parse(
      await backendRequest(path, { token }),
    );
    return json({
      ...payload,
      meta: {
        fetchedAt: new Date().toISOString(),
        limit:
          resource === "payments"
            ? 200
            : resource === "audit-logs"
              ? 100
              : null,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
