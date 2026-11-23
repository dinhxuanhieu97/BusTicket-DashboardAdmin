"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  addMonths,
  dayDisabled,
  dayLabel,
  monthGrid,
  monthOf,
  monthTitle,
  orderedRange,
  vnDate,
  vnRange,
  WEEKDAY_SHORT,
  type DateRangeValue,
} from "@/lib/calendar";
import { addDays } from "@/lib/overview";

export type DateRangePreset = {
  id: string;
  label: string;
  /** `null` = bỏ lọc ngày (ví dụ "Mọi ngày"). */
  range: DateRangeValue | null;
};

/**
 * Bộ chọn khoảng ngày dùng chung: nút giống ô nhập, bấm mở popup ngay dưới nút (cùng kiểu, cùng hiệu ứng với
 * chuông và menu tài khoản). Trái là mốc nhanh, phải là lịch hai tháng; bấm ngày đầu rồi ngày cuối là áp dụng.
 * Điện thoại: mốc nhanh thành hàng cuộn ngang, lịch một tháng, popup trải theo bề ngang màn hình.
 */
export function DateRangePicker({
  label,
  value,
  presetId,
  presets,
  onChange,
  min,
  max,
  maxDays,
  align = "end",
  placeholder = "Chọn khoảng ngày",
}: {
  /** Tên đọc cho nút và popup, ví dụ "Khoảng thời gian". */
  label: string;
  value: DateRangeValue | null;
  /** Mốc nhanh đang chọn; `null` = khoảng tự chọn trên lịch. */
  presetId: string | null;
  presets: DateRangePreset[];
  onChange: (value: DateRangeValue | null, presetId: string | null) => void;
  min?: string;
  max?: string;
  /** Số ngày tối đa của một khoảng (tính cả hai đầu). */
  maxDays?: number;
  /** Mép popup bám theo mép nào của nút trên màn rộng. */
  align?: "start" | "end";
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();
  const preset = presets.find((p) => p.id === presetId) ?? null;
  const text = value
    ? preset
      ? `${preset.label} · ${vnRange(value)}`
      : vnRange(value)
    : (preset?.label ?? placeholder);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      ref={wrap}
      className="relative min-w-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="pn-date-trigger"
        aria-label={`${label}: ${text}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen(!open)}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span className="truncate tabular-nums">{text}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pn-date-trigger-chevron"
        />
      </button>
      {open && (
        <DateRangePopup
          id={popId}
          popRef={pop}
          anchorRef={button}
          label={label}
          value={value}
          presetId={presetId}
          presets={presets}
          min={min}
          max={max}
          maxDays={maxDays}
          align={align}
          onPick={(v, id) => {
            onChange(v, id);
            close();
          }}
        />
      )}
    </div>
  );
}

function DateRangePopup({
  id,
  popRef,
  anchorRef,
  label,
  value,
  presetId,
  presets,
  min,
  max,
  maxDays,
  align,
  onPick,
}: {
  id: string;
  popRef: React.RefObject<HTMLDivElement | null>;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  value: DateRangeValue | null;
  presetId: string | null;
  presets: DateRangePreset[];
  min?: string;
  max?: string;
  maxDays?: number;
  align: "start" | "end";
  onPick: (value: DateRangeValue | null, presetId: string | null) => void;
}) {
  const start = value?.to ?? max ?? new Date().toISOString().slice(0, 10);
  // `view` là tháng bên phải (tháng cuối đang hiện); bên trái là tháng trước đó.
  const [view, setView] = useState(() => monthOf(start));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(start);
  const [phone, setPhone] = useState(false);
  const [style, setStyle] = useState<CSSProperties | undefined>();
  const focusPending = useRef(true);

  // Điện thoại: popup cố định theo bề ngang màn hình, ngay dưới nút (không tràn ngang dù nút ở mép nào).
  const [side, setSide] = useState(align);
  useLayoutEffect(() => {
    const narrow = window.matchMedia("(max-width: 639.98px)").matches;
    setPhone(narrow);
    if (narrow && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setStyle({ top: r.bottom + 8 });
    }
  }, [anchorRef]);
  // Màn rộng: nút có thể xuống dòng sang trái (hero hẹp) — bám mép còn đủ chỗ để popup không tràn ra ngoài.
  useLayoutEffect(() => {
    if (phone || !popRef.current || !anchorRef.current) return;
    const pop = popRef.current.getBoundingClientRect();
    const btn = anchorRef.current.getBoundingClientRect();
    const gap = 8;
    const fitsEnd = btn.right - pop.width >= gap;
    const fitsStart = btn.left + pop.width <= window.innerWidth - gap;
    const next =
      align === "end"
        ? fitsEnd || !fitsStart
          ? "end"
          : "start"
        : fitsStart || !fitsEnd
          ? "start"
          : "end";
    if (next !== side) setSide(next);
  }, [align, anchorRef, phone, popRef, side, view]);

  // Mở xong: đưa con trỏ bàn phím vào ngày đang chọn (hoặc hôm nay).
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    popRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)
      ?.focus({ preventScroll: true });
  }, [focusDate, popRef, view]);

  const months = phone ? [view] : [addMonths(view, -1), view];
  const lastMonth = max ? monthOf(max) : null;
  const firstMonth = min ? monthOf(min) : null;
  const canNext = (n: number) => !lastMonth || addMonths(view, n) <= lastMonth;
  const canPrev = (n: number) =>
    !firstMonth || addMonths(months[0]!, -n) >= firstMonth;

  // Đang chọn: tô từ ngày đầu tới ngày đang trỏ; chưa chọn: tô khoảng hiện tại.
  const shown = anchor !== null ? orderedRange(anchor, hover ?? anchor) : value;
  const disabled = (d: string) => dayDisabled(d, { min, max, anchor, maxDays });

  function pick(d: string) {
    if (disabled(d)) return;
    if (anchor === null) {
      setAnchor(d);
      setHover(d);
      return;
    }
    onPick(orderedRange(anchor, d), null);
  }

  function moveFocus(d: string) {
    if (min && d < min) d = min;
    if (max && d > max) d = max;
    const m = monthOf(d);
    if (m > view) setView(m);
    else if (m < months[0]!) setView(phone ? m : addMonths(m, 1));
    setFocusDate(d);
    if (anchor) setHover(d);
    focusPending.current = true;
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in steps) {
      e.preventDefault();
      moveFocus(addDays(focusDate, steps[e.key]!));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const n = e.key === "PageUp" ? -1 : 1;
      const m = addMonths(monthOf(focusDate), n);
      const day = Number(focusDate.slice(8, 10));
      const last = Number(addDays(addMonths(m, 1), -1).slice(8, 10));
      moveFocus(
        `${m.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`,
      );
    }
  }

  return (
    <div
      ref={popRef}
      id={id}
      role="dialog"
      aria-label={label}
      className={`pn-account-menu pn-date-pop ${side === "start" ? "pn-date-pop-start" : ""}`}
      style={style}
    >
      <div className="pn-date-presets" role="group" aria-label="Chọn nhanh">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={anchor === null && p.id === presetId}
            onClick={() => onPick(p.range, p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="pn-date-main">
        <div className="pn-date-head" aria-live="polite">
          <span className={shown ? "" : "text-muted"}>
            {shown ? vnDate(shown.from) : "Từ ngày"}
          </span>
          <span aria-hidden="true">~</span>
          <span className={shown && anchor === null ? "" : "text-muted"}>
            {anchor !== null
              ? "Chọn ngày kết thúc"
              : shown
                ? vnDate(shown.to)
                : "Đến ngày"}
          </span>
        </div>
        <div className="pn-date-months" onKeyDown={onGridKey}>
          {months.map((month, i) => {
            const first = i === 0;
            const last = i === months.length - 1;
            return (
              <div key={month} className="pn-date-month">
                <div className="pn-date-month-head">
                  {first ? (
                    <span className="flex">
                      <NavButton
                        label="Năm trước"
                        disabled={!canPrev(12)}
                        onClick={() => setView(addMonths(view, -12))}
                      >
                        <ChevronsLeft size={16} />
                      </NavButton>
                      <NavButton
                        label="Tháng trước"
                        disabled={!canPrev(1)}
                        onClick={() => setView(addMonths(view, -1))}
                      >
                        <ChevronLeft size={16} />
                      </NavButton>
                    </span>
                  ) : (
                    <span className="w-16" />
                  )}
                  <b>{monthTitle(month)}</b>
                  {last ? (
                    <span className="flex">
                      <NavButton
                        label="Tháng sau"
                        disabled={!canNext(1)}
                        onClick={() => setView(addMonths(view, 1))}
                      >
                        <ChevronRight size={16} />
                      </NavButton>
                      <NavButton
                        label="Năm sau"
                        disabled={!canNext(12)}
                        onClick={() => setView(addMonths(view, 12))}
                      >
                        <ChevronsRight size={16} />
                      </NavButton>
                    </span>
                  ) : (
                    <span className="w-16" />
                  )}
                </div>
                <div
                  className="pn-date-grid"
                  role="group"
                  aria-label={monthTitle(month)}
                >
                  {WEEKDAY_SHORT.map((w) => (
                    <span key={w} className="pn-date-wd" aria-hidden="true">
                      {w}
                    </span>
                  ))}
                  {monthGrid(month).map(({ date, inMonth }) => {
                    if (!inMonth)
                      return (
                        <span
                          key={date}
                          className="pn-date-out"
                          aria-hidden="true"
                        >
                          {Number(date.slice(8, 10))}
                        </span>
                      );
                    const off = disabled(date);
                    const edge =
                      !!shown && (date === shown.from || date === shown.to);
                    const inside =
                      !!shown && date > shown.from && date < shown.to;
                    return (
                      <button
                        key={date}
                        type="button"
                        data-date={date}
                        className="pn-date-day"
                        data-edge={edge || undefined}
                        data-inside={inside || undefined}
                        data-start={(shown && date === shown.from) || undefined}
                        data-end={(shown && date === shown.to) || undefined}
                        aria-label={dayLabel(date)}
                        aria-pressed={edge}
                        aria-disabled={off || undefined}
                        aria-current={date === max ? "date" : undefined}
                        tabIndex={date === focusDate ? 0 : -1}
                        onClick={() => {
                          setFocusDate(date);
                          pick(date);
                        }}
                        onPointerEnter={() => anchor && !off && setHover(date)}
                        onFocus={() => anchor && !off && setHover(date)}
                      >
                        {Number(date.slice(8, 10))}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {maxDays && (
          <p className="pn-date-note">
            Tối đa {maxDays.toLocaleString("vi-VN")} ngày. Bấm ngày bắt đầu rồi
            ngày kết thúc.
          </p>
        )}
      </div>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="pn-date-nav"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
