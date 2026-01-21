import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiProps {
  active: boolean;
  duration?: number;
  particleCount?: number;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  rotation: number;
  scale: number;
  delay: number;
}

const COLORS = [
  "#FFD700", // Gold
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    delay: Math.random() * 0.5,
  }));
}

export function Confetti({
  active,
  duration = 3000,
  particleCount = 50,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (active) {
      setParticles(generateParticles(particleCount));
      setShow(true);

      const timer = setTimeout(() => {
        setShow(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [active, duration, particleCount]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{
                x: `${particle.x}vw`,
                y: "-10vh",
                rotate: 0,
                scale: particle.scale,
                opacity: 1,
              }}
              animate={{
                y: "110vh",
                rotate: particle.rotation + 720,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2 + Math.random(),
                delay: particle.delay,
                ease: "easeIn",
              }}
              className="absolute"
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: particle.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

// Hook to trigger confetti
export function useConfetti() {
  const [trigger, setTrigger] = useState(0);

  const fire = useCallback(() => {
    setTrigger((prev) => prev + 1);
  }, []);

  return { trigger, fire };
}

// Wrapper that tracks goal completion and auto-fires confetti
interface GoalConfettiProps {
  current: number;
  target: number;
  children?: React.ReactNode;
}

export function GoalConfetti({ current, target, children }: GoalConfettiProps) {
  const [hasTriggered, setHasTriggered] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const isComplete = target > 0 && current >= target;

  useEffect(() => {
    // Only trigger once when goal is first completed
    if (isComplete && !hasTriggered) {
      setHasTriggered(true);
      setShowConfetti(true);
    }

    // Reset if goal changes and we're no longer complete
    if (!isComplete) {
      setHasTriggered(false);
    }
  }, [isComplete, hasTriggered]);

  return (
    <>
      <Confetti active={showConfetti} />
      {children}
    </>
  );
}

// Simple celebration burst that doesn't cover the whole screen
export function CelebrationBurst({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (active) {
      setParticles(generateParticles(20));
      setShow(true);

      const timer = setTimeout(() => {
        setShow(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [active]);

  return (
    <AnimatePresence>
      {show && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{
                x: "50%",
                y: "50%",
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: `${25 + Math.random() * 50}%`,
                y: `${Math.random() * 100}%`,
                scale: particle.scale,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 1,
                delay: particle.delay * 0.3,
                ease: "easeOut",
              }}
              className="absolute"
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: particle.color,
                borderRadius: "50%",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
