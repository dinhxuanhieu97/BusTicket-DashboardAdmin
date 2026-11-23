import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import { errorResponse, json, protectMutation } from "@/lib/server/session";
import { alertAccess } from "@/lib/server/alert-access";

/** Gửi thư thử bằng cấu hình đã lưu (API giới hạn 5 lần / 10 phút). */
export async function POST(request: Request) {
  try {
    protectMutation(request);
    const { token, path } = await alertAccess();
    return json(
      z
        .object({ sentTo: z.array(z.string()) })
        .parse(await backendRequest(`${path}/test`, { token, method: "POST" })),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
