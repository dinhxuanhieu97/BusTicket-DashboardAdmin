import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <section className="card w-full max-w-md space-y-4 p-5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Không tìm thấy trang
        </h1>
        <Link className="btn btn-primary" href="/admin">
          Về trang tổng quan
        </Link>
      </section>
    </main>
  );
}
