import { backendRequest } from "@/lib/backend-client";
import { platformOperatorsSchema } from "@/lib/platform";
import { platformOwnerAccess, rejectQuery } from "@/lib/server/platform";
import { errorResponse, json } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    rejectQuery(request);
    const { token } = await platformOwnerAccess("operator.list");
    const data = platformOperatorsSchema.parse(
      await backendRequest("/api/v1/admin/operators", { token }),
    );
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
