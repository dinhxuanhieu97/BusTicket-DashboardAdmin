import { requirePermission } from "@/lib/access-policy";
import { backendBase } from "@/lib/backend-client";
import { PROOF_MAX_BYTES, PROOF_TYPES, UUID } from "@/lib/payment-proofs";
import { errorResponse, operatorSession } from "@/lib/server/session";

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });

/**
 * Ảnh lệnh chuyển khoản (`payment.read`), phục vụ cùng origin. Ảnh có thể chứa số tài khoản/tên khách nên
 * không lưu đệm, không cho trình duyệt đoán kiểu và chặn mọi script trong ảnh.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "payment.read");
    const { id } = await params;
    if (!UUID.test(id)) return notFound();
    const res = await fetch(
      `${backendBase()}/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/payment-proofs/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      },
    );
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!res.ok || !(PROOF_TYPES as readonly string[]).includes(type))
      return notFound();
    const data = new Uint8Array(await res.arrayBuffer());
    if (!data.length || data.length > PROOF_MAX_BYTES) return notFound();
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self'; sandbox",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
