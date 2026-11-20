"use client";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { Modal } from "../modal";

export type PaletteItem = {
  href: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
};

/** Bỏ dấu để gõ "so thu" vẫn ra "Sổ thu". */
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/** Hộp tìm nhanh (⌘K / Ctrl+K): lọc các trang người dùng được phép mở rồi chuyển tới. */
export function CommandPalette({
  items,
  onClose,
}: {
  items: PaletteItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const q = fold(query);
    if (!q) return items;
    return items.filter((i) => fold(`${i.label} ${i.group}`).includes(q));
  }, [items, query]);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  return (
    <Modal title="Tìm nhanh" focusClose={false} onClose={onClose}>
      <div className="space-y-3">
        <label className="flex min-h-11 items-center gap-2.5 rounded-[0.8125rem] border border-line bg-surface px-3 focus-within:border-accent focus-within:shadow-[0_0_0_2px_var(--accent-glow)]">
          <Search size={17} aria-hidden="true" className="text-muted" />
          <input
            type="text"
            role="combobox"
            enterKeyHint="go"
            autoComplete="off"
            data-autofocus
            aria-label="Tìm trang"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              results.length ? `${listId}-${current}` : undefined
            }
            placeholder="Gõ tên trang, ví dụ: sổ thu"
            className="min-w-0 flex-1 bg-transparent py-2 text-base md:text-sm"
            // Khung bao ngoài đã đổi viền khi focus; tắt viền :focus-visible toàn cục để không thành hai vòng.
            style={{ outline: "none" }}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive(Math.min(current + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(Math.max(current - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[current]);
              }
            }}
          />
        </label>
        <ul id={listId} role="listbox" aria-label="Trang" className="space-y-1">
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.href}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === current}
                data-active={index === current}
                className="pn-palette-option flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.8125rem] px-3 text-sm text-muted"
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
              >
                <Icon size={17} aria-hidden={true} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.label}
                </span>
                <span className="text-xs text-faint">{item.group}</span>
                {index === current && (
                  <CornerDownLeft size={14} aria-hidden={true} />
                )}
              </li>
            );
          })}
        </ul>
        {!results.length && (
          <p className="py-6 text-center text-sm text-muted">
            Không có trang nào khớp “{query.trim()}”.
          </p>
        )}
      </div>
    </Modal>
  );
}
