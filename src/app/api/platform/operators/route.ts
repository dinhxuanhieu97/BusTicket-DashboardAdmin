import { backendRequest } from "@/lib/backend-client";
import {
  createOperatorInput,
  platformOperatorSchema,
  platformOperatorsSchema,
} from "@/lib/platform";
import { platformOwnerAccess, rejectQuery } from "@/lib/server/platform";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";

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

/** Tạo nhà xe mới (API tạo kèm chính sách mặc định và 2 xe mẫu). Mã trùng → 409 từ API. */
export async function POST(request: Request) {
  try {
    protectMutation(request);
    rejectQuery(request);
    const { token } = await platformOwnerAccess("operator.create");
    const body = await input(request, createOperatorInput);
    const operator = platformOperatorSchema.parse(
      await backendRequest("/api/v1/admin/operators", {
        token,
        method: "POST",
        body,
      }),
    );
    return json({ operator }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
