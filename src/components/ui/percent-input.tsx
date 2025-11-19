import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

type PercentInputProps = {
  value: number | undefined; // decimal 0..1
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
};

export function PercentInput({ value, onChange, placeholder, className }: PercentInputProps) {
  const [focused, setFocused] = useState(false);
  const [buf, setBuf] = useState("");

  // Display: focused = buffer, not focused = formatted %
  const display = focused
    ? buf
    : (typeof value === 'number' && Number.isFinite(value) 
        ? (value * 100).toFixed(2).replace(/\.?0+$/, "") + "%" 
        : "");

  useEffect(() => {
    if (!focused) setBuf("");
  }, [focused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder ?? "e.g., 12"}
      value={display}
      onFocus={() => {
        setFocused(true);
        const start = typeof value === 'number' && Number.isFinite(value)
          ? (value * 100).toFixed(2).replace(/\.00$/, "")
          : "";
        setBuf(start);
      }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^\d.]/g, "");
        const cleaned = s.split(".").slice(0, 2).join(".");
        if (cleaned === "") return setBuf("");
        const n = Number(cleaned);
        if (Number.isFinite(n) && n <= 100) setBuf(cleaned);
      }}
      onBlur={() => {
        setFocused(false);
        const n = Number(buf);
        const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
        onChange(pct > 0 ? pct / 100 : undefined); // commit decimal 0..1
        setBuf("");
      }}
      className={className}
    />
  );
}
