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
  dayLabel,
  monthGrid,
  monthOf,
  monthTitle,
  periodText,
  WEEKDAY_SHORT,
  YEAR_PAGE,
  yearPageStart,
  type PeriodMode,
} from "@/lib/calendar";
import { addDays } from "@/lib/overview";

/**
 * Chọn một ngày, một tháng hoặc một năm — cùng nút và popup với `DateRangePicker` (mở ngay dưới nút,
 * cùng nền/viền/bóng/hiệu ứng với chuông và menu tài khoản). Ngày: lịch một tháng; tháng: lưới 12 tháng;
 * năm: lưới 12 năm. Bấm là chọn và đóng; nút cuối popup về hôm nay/tháng này/năm nay.
 * `value` luôn là `YYYY-MM-DD` (tháng → ngày 01, năm → 01-01).
 */
export function PeriodPicker({
  label,
  mode,
  value,
  today,
  onChange,
  align = "start",
}: {
  label: string;
  mode: PeriodMode;
  value: string;
  /** Hôm nay theo giờ Việt Nam (đánh dấu ô hiện tại, nút "Hôm nay"). */
  today: string;
  onChange: (date: string) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();
  const text = periodText(mode, value);

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
        data-value={value}
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
        <PeriodPopup
          key={mode}
          id={popId}
          popRef={pop}
          anchorRef={button}
          label={label}
          mode={mode}
          value={value}
          today={today}
          align={align}
          onPick={(d) => {
            onChange(d);
            close();
          }}
        />
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Ô (ngày/tháng/năm) chứa ngày `d`: tháng → ngày 01, năm → 01-01. */
const cellFor = (mode: PeriodMode, d: string) =>
  mode === "day"
    ? d
    : mode === "month"
      ? `${d.slice(0, 7)}-01`
      : `${d.slice(0, 4)}-01-01`;

function PeriodPopup({
  id,
  popRef,
  anchorRef,
  label,
  mode,
  value,
  today,
  align,
  onPick,
}: {
  id: string;
  popRef: React.RefObject<HTMLDivElement | null>;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  mode: PeriodMode;
  value: string;
  today: string;
  align: "start" | "end";
  onPick: (date: string) => void;
}) {
  // Trang đang xem: tháng (chọn ngày), năm (chọn tháng) hoặc trang 12 năm (chọn năm).
  const [view, setView] = useState(() =>
    mode === "day"
      ? monthOf(value)
      : mode === "month"
        ? `${value.slice(0, 4)}-01-01`
        : `${yearPageStart(Number(value.slice(0, 4)))}-01-01`,
  );
  const [focus, setFocus] = useState(() => cellFor(mode, value));
  const focusPending = useRef(true);
  const [style, setStyle] = useState<CSSProperties | undefined>();
  const [side, setSide] = useState(align);

  useLayoutEffect(() => {
    const narrow = window.matchMedia("(max-width: 639.98px)").matches;
    if (narrow && anchorRef.current) {
      setStyle({ top: anchorRef.current.getBoundingClientRect().bottom + 8 });
      return;
    }
    if (!popRef.current || !anchorRef.current) return;
    const p = popRef.current.getBoundingClientRect();
    const b = anchorRef.current.getBoundingClientRect();
    const fitsEnd = b.right - p.width >= 8;
    const fitsStart = b.left + p.width <= window.innerWidth - 8;
    const next =
      align === "end"
        ? fitsEnd || !fitsStart
          ? "end"
          : "start"
        : fitsStart || !fitsEnd
          ? "start"
          : "end";
    if (next !== side) setSide(next);
  }, [align, anchorRef, popRef, side]);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    popRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)
      ?.focus({ preventScroll: true });
  }, [focus, popRef, view]);

  const year = Number(view.slice(0, 4));
  const pageStart = yearPageStart(year);

  const cellOf = (d: string) => cellFor(mode, d);
  const selected = cellOf(value);
  const current = cellOf(today);

  function moveFocus(next: string) {
    const v =
      mode === "day"
        ? monthOf(next)
        : mode === "month"
          ? `${next.slice(0, 4)}-01-01`
          : `${yearPageStart(Number(next.slice(0, 4)))}-01-01`;
    setView(v);
    setFocus(next);
    focusPending.current = true;
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const cols = mode === "day" ? 7 : 3;
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -cols,
      ArrowDown: cols,
    };
    const step = steps[e.key];
    if (step === undefined) return;
    e.preventDefault();
    if (mode === "day") moveFocus(addDays(focus, step));
    else if (mode === "month") moveFocus(addMonths(focus, step));
    else moveFocus(`${Number(focus.slice(0, 4)) + step}-01-01`);
  }

  // Điều hướng trang: ngày → tháng/năm; tháng → năm; năm → 12 năm.
  const nav =
    mode === "day"
      ? {
          title: monthTitle(view),
          bigPrev: () => setView(addMonths(view, -12)),
          prev: () => setView(addMonths(view, -1)),
          next: () => setView(addMonths(view, 1)),
          bigNext: () => setView(addMonths(view, 12)),
          prevLabel: "Tháng trước",
          nextLabel: "Tháng sau",
        }
      : mode === "month"
        ? {
            title: `Năm ${year}`,
            prev: () => setView(`${year - 1}-01-01`),
            next: () => setView(`${year + 1}-01-01`),
            prevLabel: "Năm trước",
            nextLabel: "Năm sau",
          }
        : {
            title: `${pageStart} – ${pageStart + YEAR_PAGE - 1}`,
            prev: () => setView(`${pageStart - YEAR_PAGE}-01-01`),
            next: () => setView(`${pageStart + YEAR_PAGE}-01-01`),
            prevLabel: `${YEAR_PAGE} năm trước`,
            nextLabel: `${YEAR_PAGE} năm sau`,
          };

  const cell = (date: string, text: string, aria: string) => {
    const on = date === selected;
    return (
      <button
        key={date}
        type="button"
        data-date={date}
        className={`pn-date-day ${mode === "day" ? "" : "pn-period-cell"}`}
        data-edge={on || undefined}
        aria-pressed={on}
        aria-label={aria}
        aria-current={date === current ? "date" : undefined}
        tabIndex={date === focus ? 0 : -1}
        onClick={() => onPick(date)}
      >
        {text}
      </button>
    );
  };

  const todayLabel =
    mode === "day" ? "Hôm nay" : mode === "month" ? "Tháng này" : "Năm nay";

  return (
    <div
      ref={popRef}
      id={id}
      role="dialog"
      aria-label={label}
      className={`pn-account-menu pn-date-pop pn-period-pop ${side === "start" ? "pn-date-pop-start" : ""}`}
      style={style}
    >
      <div className="pn-date-main">
        <div className="pn-date-month-head">
          <span className="flex">
            {nav.bigPrev && (
              <NavButton label="Năm trước" onClick={nav.bigPrev}>
                <ChevronsLeft size={16} />
              </NavButton>
            )}
            <NavButton label={nav.prevLabel} onClick={nav.prev}>
              <ChevronLeft size={16} />
            </NavButton>
          </span>
          <b aria-live="polite">{nav.title}</b>
          <span className="flex">
            <NavButton label={nav.nextLabel} onClick={nav.next}>
              <ChevronRight size={16} />
            </NavButton>
            {nav.bigNext && (
              <NavButton label="Năm sau" onClick={nav.bigNext}>
                <ChevronsRight size={16} />
              </NavButton>
            )}
          </span>
        </div>
        <div
          className={mode === "day" ? "pn-date-grid" : "pn-period-grid"}
          role="group"
          aria-label={nav.title}
          onKeyDown={onKey}
        >
          {mode === "day" &&
            WEEKDAY_SHORT.map((w) => (
              <span key={w} className="pn-date-wd" aria-hidden="true">
                {w}
              </span>
            ))}
          {mode === "day" &&
            monthGrid(view).map(({ date, inMonth }) =>
              inMonth ? (
                cell(date, String(Number(date.slice(8, 10))), dayLabel(date))
              ) : (
                <span key={date} className="pn-date-out" aria-hidden="true">
                  {Number(date.slice(8, 10))}
                </span>
              ),
            )}
          {mode === "month" &&
            Array.from({ length: 12 }, (_, i) =>
              cell(
                `${year}-${pad(i + 1)}-01`,
                `Thg ${i + 1}`,
                `Tháng ${i + 1} năm ${year}`,
              ),
            )}
          {mode === "year" &&
            Array.from({ length: YEAR_PAGE }, (_, i) =>
              cell(
                `${pageStart + i}-01-01`,
                String(pageStart + i),
                `Năm ${pageStart + i}`,
              ),
            )}
        </div>
        <div className="pn-period-foot">
          <button
            type="button"
            className="btn px-3 text-xs"
            onClick={() => onPick(cellOf(today))}
          >
            {todayLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="pn-date-nav"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
