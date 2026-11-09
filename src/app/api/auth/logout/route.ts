import {
  protectMutation,
  clearSession,
  json,
  errorResponse,
} from "@/lib/server/session";
export async function POST(req: Request) {
  try {
    protectMutation(req);
    return clearSession(json({ ok: true }));
  } catch (e) {
    return errorResponse(e);
  }
}
