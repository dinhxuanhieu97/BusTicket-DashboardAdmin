import { backendBase } from "@/lib/backend-client";
import { LOGO_MAX_BYTES, LOGO_TYPES, OPERATOR_CODE } from "@/lib/brand";

type Context = { params: Promise<{ code: string }> };
const notFound = () =>
  new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** Logo nhà xe (dữ liệu công khai) phục vụ cùng origin để trang đăng nhập không phải tải ảnh từ host khác. */
export async function GET(_req: Request, { params }: Context) {
  const { code } = await params;
  if (!OPERATOR_CODE.test(code)) return notFound();
  try {
    const res = await fetch(`${backendBase()}/api/v1/operators/${code}/logo`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!res.ok || !(LOGO_TYPES as readonly string[]).includes(type))
      return notFound();
    const data = new Uint8Array(await res.arrayBuffer());
    if (!data.length || data.length > LOGO_MAX_BYTES) return notFound();
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return notFound();
  }
}
