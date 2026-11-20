import type { ReactNode } from "react";

/** Đầu trang: tiêu đề lớn, dòng mô tả, ghi chú phụ và nhóm nút bên phải (xuống dòng trên điện thoại). */
export function PageHero({
  title,
  description,
  note,
  actions,
  titleId,
}: {
  title: ReactNode;
  description?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}) {
  return (
    <header className="pn-page-hero">
      <div className="min-w-0">
        <h2 id={titleId} className="pn-page-hero-title">
          {title}
        </h2>
        {description && <p className="text-sm text-muted">{description}</p>}
        {note && <p className="mt-0.5 text-xs text-muted/80">{note}</p>}
      </div>
      {actions && <div className="pn-page-hero-actions">{actions}</div>}
    </header>
  );
}
