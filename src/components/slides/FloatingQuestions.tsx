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
const ZONES = [
  { xMin: 5, xMax: 35, yMin: 8, yMax: 30 },   // top-left
  { xMin: 55, xMax: 90, yMin: 8, yMax: 30 },   // top-right
  { xMin: 3, xMax: 30, yMin: 55, yMax: 80 },   // bottom-left
  { xMin: 60, xMax: 92, yMin: 55, yMax: 80 },   // bottom-right
  { xMin: 5, xMax: 40, yMin: 35, yMax: 55 },   // mid-left
  { xMin: 55, xMax: 92, yMin: 35, yMax: 55 },   // mid-right
  { xMin: 20, xMax: 75, yMin: 75, yMax: 90 },   // bottom-center
  { xMin: 20, xMax: 75, yMin: 5, yMax: 18 },    // top-center
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
            className="absolute max-w-xs md:max-w-sm text-sm md:text-base italic"
            style={{
              left: `${q.x}%`,
              top: `${q.y}%`,
              color: 'var(--marketing-text-muted)',
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
