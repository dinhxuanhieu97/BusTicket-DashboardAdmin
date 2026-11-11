import { z } from "zod";
import QRCode from "qrcode";
import { backendRequest } from "@/lib/backend-client";
import { ApiError } from "@/lib/access-policy";
import {
  ownerSession,
  protectMutation,
  json,
  errorResponse,
} from "@/lib/server/session";
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const { token, session } = await ownerSession(true);
    if (session.user.mfaEnabled)
      throw new ApiError(409, "CONFLICT", "Tài khoản đã bật 2FA.");
    const data = z
      .object({
        secret: z.string(),
        otpauthUri: z.string().startsWith("otpauth://totp/"),
      })
      .parse(
        await backendRequest("/api/v1/auth/mfa/setup", {
          token,
          method: "POST",
        }),
      );
    return json({
      secret: data.secret,
      qr: await QRCode.toDataURL(data.otpauthUri, { width: 240, margin: 2 }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
