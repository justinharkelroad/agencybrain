import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const INITIAL_SECONDS = 180; // 3 minutes

export function CountdownTimer() {
  const [seconds, setSeconds] = useState(INITIAL_SECONDS);
  const [running, setRunning] = useState(false);
  const isZero = seconds <= 0;

  useEffect(() => {
    if (!running || isZero) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running, isZero]);

  const toggle = useCallback(() => {
    if (isZero) return;
    setRunning((r) => !r);
  }, [isZero]);

  const reset = useCallback(() => {
    setRunning(false);
    setSeconds(INITIAL_SECONDS);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'font-mono text-4xl md:text-5xl font-bold tracking-wider tabular-nums',
          isZero
            ? 'text-red-500 animate-pulse'
            : 'text-[var(--marketing-text)]'
        )}
      >
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>

      <button
        onClick={toggle}
        className="relative z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-[var(--marketing-text)] cursor-pointer"
        aria-label={running ? 'Pause' : 'Play'}
      >
        {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>

      <button
        onClick={reset}
        className="relative z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-[var(--marketing-text)] cursor-pointer"
        aria-label="Reset"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
    </div>
  );
}
