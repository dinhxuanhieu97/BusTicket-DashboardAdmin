"use client";

import { Notice } from "@/components/live/shared";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card pn-panel-inset">
      <Notice tone="danger">
        <h2 className="font-semibold">Chưa tải được trang</h2>
        <p className="mt-1">Vui lòng kiểm tra kết nối và thử lại.</p>
      </Notice>
      <button type="button" className="btn mt-4" onClick={reset}>
        Thử lại
      </button>
    </section>
  );
}
