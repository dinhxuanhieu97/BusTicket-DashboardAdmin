import { backendRequest } from "@/lib/backend-client";
import { ownerListSchema } from "@/lib/platform";
import {
  platformOwnerAccess,
  rejectQuery,
  uuidParam,
} from "@/lib/server/platform";
import { errorResponse, json } from "@/lib/server/session";

type Context = { params: Promise<{ operatorId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    rejectQuery(request);
    const operatorId = uuidParam((await params).operatorId, "nhà xe");
    const { token } = await platformOwnerAccess("owner.password.reset");
    return json(
      ownerListSchema.parse(
        await backendRequest(`/api/v1/admin/operators/${operatorId}/owners`, {
          token,
        }),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
