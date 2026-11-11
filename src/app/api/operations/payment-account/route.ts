import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

const accountInput = z.strictObject({
  bankCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,20}$/),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,30}$/),
  accountName: z.string().trim().min(1).max(120),
  webhookApiKey: z.string().min(24).max(200),
  apiToken: z.string().min(10).max(500).optional(),
  password: z.string().min(1).max(128),
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
const accountResponse = z.object({
  account: z
    .object({
      bankCode: z.string(),
      accountNumber: z.string(),
      accountName: z.string(),
      reconcileEnabled: z.boolean(),
    })
    .nullable(),
});

async function accountAccess() {
  const { token, session } = await operatorSession();
  requirePermission(session, "payment.configure");
  return {
    token,
    path: `/api/v1/admin/operators/${session.user.operatorId}/payment-account`,
  };
}

export async function GET() {
  try {
    const { token, path } = await accountAccess();
    return json(accountResponse.parse(await backendRequest(path, { token })));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    protectMutation(request);
    const { token, path } = await accountAccess();
    const body = await input(request, accountInput);
    if (!body.apiToken) {
      const { account } = accountResponse.parse(
        await backendRequest(path, { token }),
      );
      if (account?.reconcileEnabled)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Nhập token API SePay để duy trì đối soát tự động.",
        );
    }
    return json(
      accountResponse.parse(
        await backendRequest(path, { token, method: "PUT", body }),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
