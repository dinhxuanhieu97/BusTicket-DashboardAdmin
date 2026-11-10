import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import { tripManager } from "@/lib/server/trip-management";
import { createTripInput } from "@/lib/trip-management";
import {
  protectMutation,
  input,
  json,
  errorResponse,
} from "@/lib/server/session";
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const { base, token } = await tripManager();
    const body = await input(
      req,
      z.object({ trips: z.array(createTripInput).length(2) }).strict(),
    );
    const idempotencyKey = z
      .string()
      .regex(/^[\w-]{8,80}$/)
      .parse(req.headers.get("idempotency-key"));
    return json(
      await backendRequest(base + "/trips/batch", {
        token,
        method: "POST",
        body,
        idempotencyKey,
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
