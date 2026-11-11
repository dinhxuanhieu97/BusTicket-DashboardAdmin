import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import {
  userSession,
  protectMutation,
  input,
  issueSession,
  errorResponse,
} from "@/lib/server/session";
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const { token } = await userSession(true);
    const body = await input(
      req,
      z.object({ otp: z.string().regex(/^\d{6}$/) }).strict(),
    );
    return issueSession(
      await backendRequest("/api/v1/auth/mfa/confirm", {
        token,
        method: "POST",
        body,
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
