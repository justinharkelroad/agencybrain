import { useState, useEffect } from "react";
import { type CellAddr } from "./rows";
import { formatValue } from "./format";
import { normalizeRate } from "./normalize";

interface PercentInputProps {
  addr: CellAddr;
  state: Record<CellAddr, any>;
  setState: (addr: CellAddr, val: any) => void;
  placeholder?: string;
  className?: string;
}

export function PercentInput({ addr, state, setState, placeholder, className }: PercentInputProps) {
  const [focused, setFocused] = useState(false);
  const [buffer, setBuffer] = useState("");
  
  const decimalValue = Number(state[addr] ?? 0); // 0-1 stored in state
  
  // Clear buffer when not focused
  useEffect(() => {
    if (!focused) {
      setBuffer("");
    }
  }, [focused]);
  
  const displayValue = focused 
    ? buffer 
    : formatValue(addr, decimalValue);
  
  const handleFocus = () => {
    setFocused(true);
    // Initialize buffer with percent value (multiply by 100, remove .00 if whole number)
    const percentValue = (decimalValue * 100).toFixed(2);
    setBuffer(percentValue.replace(/\.00$/, ""));
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!focused) return;
    
    const value = e.target.value;
    // Allow only digits and one decimal point
    const cleaned = value.replace(/[^\d.]/g, "");
    
    // Prevent multiple decimal points
    const parts = cleaned.split(".");
    const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
    
    // Clamp to 0-100 range during typing
    const num = Number(sanitized);
    if (sanitized === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
      setBuffer(sanitized);
    }
  };
  
  const handleBlur = () => {
    setFocused(false);
    
    // Commit the value to state as decimal (0-1)
    const num = Number(buffer);
    const percentValue = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
    const decimalValue = percentValue / 100;
    
    setState(addr, decimalValue);
  };
  
  return (
    <input
      className={className || "border border-input rounded-lg px-3 py-2 bg-background text-foreground placeholder-muted-foreground focus:border-ring"}
      inputMode="decimal"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}