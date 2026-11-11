import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import {
  protectMutation,
  input,
  issueSession,
  errorResponse,
} from "@/lib/server/session";
const schema = z
  .object({
    phone: z.string().min(1).max(30),
    password: z.string().min(1).max(128),
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    rememberMe: z.boolean().optional(),
  })
  .strict();
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const body = await input(req, schema);
    return issueSession(
      await backendRequest("/api/v1/auth/login", { method: "POST", body }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
