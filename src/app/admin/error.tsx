"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card p-8">
      <h2 className="font-bold">Chưa tải được trang</h2>
      <p className="mt-2 text-sm text-muted">
        Vui lòng kiểm tra kết nối và thử lại.
      </p>
      <button className="btn mt-5" onClick={reset}>
        Thử lại
      </button>
    </section>
  );
}
