import React, { useRef, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max" | "type"> & {
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onCommit: (value: number) => void;
};

/**
 * Number input that lets the user type freely. While typing, a value is
 * committed only once it is a valid number inside [min, max]; on blur or Enter
 * an out-of-range value is clamped and an empty/invalid entry is reverted.
 * (Clamping on every keystroke turned "100" into 24 → 240 → 200.)
 */
export function NumberField({ value, min, max, integer = false, onCommit, onBlur, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const parse = (text: string) => {
    const n = text.trim() === "" ? NaN : Number(text);
    return Number.isFinite(n) ? n : null;
  };
  const valid = (n: number) => n >= min && n <= max && (!integer || Number.isInteger(n));
  const finish = () => {
    if (draft === null || cancelled.current) { cancelled.current = false; setDraft(null); return; }
    const n = parse(draft);
    setDraft(null);
    if (n === null) return;
    const clamped = Math.min(max, Math.max(min, integer ? Math.round(n) : n));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parse(e.target.value);
        if (n !== null && valid(n) && n !== value) onCommit(n);
      }}
      onBlur={(e) => { finish(); onBlur?.(e); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
        onKeyDown?.(e);
      }}
    />
  );
}
