import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingQuestionsProps {
  questions: string[];
}

interface ActiveQuestion {
  id: number;
  text: string;
  x: number;
  y: number;
}

// Predefined zones to avoid center headline area
// Zones positioned well away from the center headline (center ~30-70% x, ~35-65% y)
// Zones strictly outside the center headline area (center ~20-80% x, ~25-75% y is excluded)
const ZONES = [
  { xMin: 2, xMax: 18, yMin: 3, yMax: 20 },    // top-left corner
  { xMin: 75, xMax: 95, yMin: 3, yMax: 20 },   // top-right corner
  { xMin: 2, xMax: 18, yMin: 78, yMax: 95 },   // bottom-left corner
  { xMin: 75, xMax: 95, yMin: 78, yMax: 95 },   // bottom-right corner
  { xMin: 1, xMax: 16, yMin: 30, yMax: 65 },   // far-left edge
  { xMin: 80, xMax: 97, yMin: 30, yMax: 65 },   // far-right edge
];

function randomInZone(zone: (typeof ZONES)[number]) {
  return {
    x: zone.xMin + Math.random() * (zone.xMax - zone.xMin),
    y: zone.yMin + Math.random() * (zone.yMax - zone.yMin),
  };
}

export function FloatingQuestions({ questions }: FloatingQuestionsProps) {
  const [active, setActive] = useState<ActiveQuestion[]>([]);
  const idRef = useRef(0);
  const indexRef = useRef(0);
  const usedZonesRef = useRef<Set<number>>(new Set());

  const addQuestion = useCallback(() => {
    const text = questions[indexRef.current % questions.length];
    indexRef.current++;

    // Pick a zone that isn't currently in use
    const availableZones = ZONES.map((_, i) => i).filter(
      (i) => !usedZonesRef.current.has(i)
    );
    const zoneIdx =
      availableZones.length > 0
        ? availableZones[Math.floor(Math.random() * availableZones.length)]
        : Math.floor(Math.random() * ZONES.length);

    const pos = randomInZone(ZONES[zoneIdx]);
    const id = idRef.current++;
    usedZonesRef.current.add(zoneIdx);

    const q: ActiveQuestion = { id, text, x: pos.x, y: pos.y };

    setActive((prev) => [...prev, q]);

    // Remove after 4-6s
    const duration = 4000 + Math.random() * 2000;
    setTimeout(() => {
      usedZonesRef.current.delete(zoneIdx);
      setActive((prev) => prev.filter((item) => item.id !== id));
    }, duration);
  }, [questions]);

  useEffect(() => {
    // Stagger initial questions
    const t1 = setTimeout(() => addQuestion(), 300);
    const t2 = setTimeout(() => addQuestion(), 1200);
    const t3 = setTimeout(() => addQuestion(), 2400);

    // Then add one every 2-3s
    const interval = setInterval(() => {
      addQuestion();
    }, 2000 + Math.random() * 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, [addQuestion]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {active.map((q) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute max-w-[250px] md:max-w-xs text-sm md:text-base italic rounded-lg px-3 py-2"
            style={{
              left: `${q.x}%`,
              top: `${q.y}%`,
              color: 'var(--marketing-text-muted)',
              background: 'rgba(11, 15, 20, 0.75)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              textShadow: '0 0 20px rgba(154, 52, 18, 0.3)',
            }}
          >
            "{q.text}"
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
