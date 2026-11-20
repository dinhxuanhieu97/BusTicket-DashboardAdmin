"use client";

/** Công tắc bật/tắt (role="switch"). Vùng chạm 44px, phần nhìn thấy 46×28. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="pn-switch"
      onClick={onChange}
    >
      <span aria-hidden="true" />
    </button>
  );
}
