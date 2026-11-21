"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { BusFront, CornerDownLeft, Search, Ticket } from "lucide-react";
import type { SearchResult } from "@/lib/live-contracts";
import { searchHits, searchQuery } from "@/lib/search-hits";
import { Modal } from "../modal";

export type PaletteItem = {
  href: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  /** Dòng phụ (vd. SĐT, giờ chạy) cho kết quả tìm dữ liệu. */
  detail?: string;
};

/** Kết quả API `search` → mục trong hộp tìm (đơn mở Hành khách đúng chuyến, chuyến mở Sơ đồ chỗ). */
export function searchItems(result: SearchResult): PaletteItem[] {
  return searchHits(result).map(({ kind, ...hit }) => ({
    ...hit,
    icon: kind === "booking" ? Ticket : BusFront,
  }));
}

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
  searchData = false,
}: {
  items: PaletteItem[];
  onClose: () => void;
  /** Có `trip.read`: tìm thêm chuyến và (theo quyền của máy chủ) vé qua API `search`. */
  searchData?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<{
    q: string;
    items: PaletteItem[];
    limited?: boolean;
  }>({
    q: "",
    items: [],
  });
  const [searching, setSearching] = useState(false);
  const term = query.trim();
  const wantData = searchData && searchQuery(query) !== null;
  useEffect(() => {
    if (!wantData) return;
    const controller = new AbortController();
    // Chờ người dùng ngừng gõ để không gọi API (và ghi nhật ký tra cứu khách) theo từng phím.
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/live/search?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (r) => ({
          limited: r.status === 429,
          body: r.ok ? ((await r.json()) as SearchResult) : null,
        }))
        .then(({ limited, body }) => {
          // API giới hạn số lần tìm mỗi phút (GB8): báo rõ thay vì "không có kết quả".
          setFound({ q: term, items: body ? searchItems(body) : [], limited });
          setSearching(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, wantData]);
  const results = useMemo(() => {
    const q = fold(query);
    const pages = q
      ? items.filter((i) => fold(`${i.label} ${i.group}`).includes(q))
      : items;
    return wantData && found.q === term ? [...pages, ...found.items] : pages;
  }, [items, query, found, term, wantData]);
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
            aria-label={searchData ? "Tìm trang, vé hoặc chuyến" : "Tìm trang"}
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              results.length ? `${listId}-${current}` : undefined
            }
            placeholder={
              searchData
                ? "Tên trang, mã vé, SĐT, tên khách, mã chuyến…"
                : "Gõ tên trang, ví dụ: sổ thu"
            }
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
        <ul
          id={listId}
          role="listbox"
          aria-label="Kết quả"
          aria-busy={searching}
          className="max-h-[60vh] space-y-1 overflow-y-auto"
        >
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={`${item.group}-${item.href}-${item.label}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === current}
                data-active={index === current}
                className="pn-palette-option flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.8125rem] px-3 text-sm text-muted"
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
              >
                <Icon size={17} aria-hidden={true} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="block truncate text-xs text-faint">
                      {item.detail}
                    </span>
                  )}
                </span>
                <span className="text-xs text-faint">{item.group}</span>
                {index === current && (
                  <CornerDownLeft size={14} aria-hidden={true} />
                )}
              </li>
            );
          })}
        </ul>
        {searching && (
          <p className="text-center text-xs text-muted" role="status">
            Đang tìm vé và chuyến…
          </p>
        )}
        {wantData && found.q === term && found.limited && !searching && (
          <p className="text-center text-xs text-warning" role="status">
            Bạn tìm quá nhiều lần trong một phút. Thử lại sau ít phút.
          </p>
        )}
        {!results.length &&
          !searching &&
          !(found.q === term && found.limited) && (
            <p className="py-6 text-center text-sm text-muted">
              Không có kết quả nào khớp “{query.trim()}”.
            </p>
          )}
      </div>
    </Modal>
  );
}
