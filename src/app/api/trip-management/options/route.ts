import { tripManager, tripOptions } from "@/lib/server/trip-management";
import { json, errorResponse } from "@/lib/server/session";
export async function GET() {
  try {
    const { base, token } = await tripManager();
    return json(await tripOptions(base, token));
  } catch (e) {
    return errorResponse(e);
  }
}
