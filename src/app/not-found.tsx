import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-content-center gap-5 text-center">
      <h1 className="text-3xl font-bold">Không tìm thấy trang</h1>
      <Link className="btn" href="/admin">
        Về trang tổng quan
      </Link>
    </main>
  );
}
