import React, { useEffect, useState } from "react";
import type { CellAddr } from "./rows";

type Props = {
  addr: CellAddr;
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any) => void;
  placeholder?: string;
  className?: string;
};

export default function PercentInput({ addr, state, setState, placeholder, className }: Props) {
  const [focused, setFocused] = useState(false);
  const [buf, setBuf] = useState("");
  const dec = Number(state[addr] ?? 0); // stored decimal 0..1

  // When not focused, show percent string; when focused, show the raw typing buffer
  const display = focused
    ? buf
    : (Number.isFinite(dec) ? (dec * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : "");

  useEffect(() => {
    if (!focused) setBuf("");
  }, [focused]);

  return (
    <input
      inputMode="decimal"
      placeholder={placeholder ?? "86.67"}
      value={display}
      onFocus={() => {
        setFocused(true);
        const start = Number.isFinite(dec) ? (dec * 100).toFixed(2).replace(/\.00$/, "") : "";
        setBuf(start);
      }}
      onChange={e => {
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
        setState(addr, pct / 100); // commit decimal 0..1
        setBuf("");
      }}
      className={className ?? "w-full border border-input rounded px-2 py-1 bg-background text-right tabular-nums"}
    />
  );
}