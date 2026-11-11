import { userSession, json, errorResponse } from "@/lib/server/session";
export async function GET() {
  try {
    const { session } = await userSession(true);
    return json(session);
  } catch (e) {
    return errorResponse(e);
  }
}
