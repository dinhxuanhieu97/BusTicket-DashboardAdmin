import {
  protectMutation,
  clearSession,
  json,
  errorResponse,
  revokeCurrentSession,
} from "@/lib/server/session";
export async function POST(req: Request) {
  try {
    protectMutation(req);
    await revokeCurrentSession();
    return clearSession(json({ ok: true }));
  } catch (e) {
    return errorResponse(e);
  }
}
