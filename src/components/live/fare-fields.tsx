import { vnd } from "@/lib/live-contracts";
import { parseFareThousands, type TripOptions } from "@/lib/trip-management";

export function FareFields({
  fares,
  valueFor,
  onChange,
}: {
  fares: TripOptions["vehicles"][number]["fares"];
  valueFor: (key: string) => string;
  onChange: (key: string, value: string) => void;
}) {
  if (!fares.length) return null;

  return (
    <fieldset className="min-w-0 border-t border-line pt-3">
      <legend className="pr-2 text-sm font-semibold">Giá vé theo tầng</legend>
      <p className="mb-3 text-xs text-muted">
        Nhập theo nghìn đồng. Ví dụ 700 tương ứng 700.000 ₫.
      </p>
      <div className="pn-form-grid max-w-xl sm:grid-cols-2">
        {fares.map((fare) => {
          const key = `${fare.floor}:${fare.occupancy}`;
          const value = valueFor(key);
          const amount = parseFareThousands(value);
          const invalid = value !== "" && amount === null;

          return (
            <div key={key} className="min-w-0">
              <label className="label">
                Giá {fare.label}
                <span className="pn-field-control relative block">
                  <input
                    aria-label={`Giá ${fare.label} (nghìn đồng)`}
                    aria-invalid={invalid || undefined}
                    className="field pr-16 font-mono"
                    inputMode="decimal"
                    type="text"
                    placeholder="700"
                    required
                    value={value}
                    onChange={(event) => onChange(key, event.target.value)}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-normal normal-case text-muted"
                  >
                    nghìn ₫
                  </span>
                </span>
              </label>
              <p
                className={`mt-1 min-h-4 text-xs tabular-nums ${invalid ? "text-warning" : "text-muted"}`}
              >
                {invalid
                  ? "Nhập từ 0 đến 20.000 nghìn đồng."
                  : amount !== null
                    ? vnd(amount)
                    : ""}
              </p>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
