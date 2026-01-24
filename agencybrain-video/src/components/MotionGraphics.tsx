import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import React from "react";

// Animated progress ring that fills up
export const AnimatedRing: React.FC<{
  x: number;
  y: number;
  size: number;
  progress: number; // 0-100
  color: string;
  delay?: number;
  strokeWidth?: number;
}> = ({ x, y, size, progress, color, delay = 0, strokeWidth = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const animatedProgress = interpolate(
    entrance,
    [0, 1],
    [0, progress],
    { extrapolateRight: "clamp" }
  );

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

  // Pulsing glow
  const glowIntensity = interpolate(Math.sin(frame * 0.1), [-1, 1], [10, 25]);

  return (
    <svg
      width={size}
      height={size}
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        filter: `drop-shadow(0 0 ${glowIntensity}px ${color})`,
      }}
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Animated progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.1s" }}
      />
    </svg>
  );
};

// Animated bar chart that grows
export const AnimatedBar: React.FC<{
  x: number;
  y: number;
  width: number;
  maxHeight: number;
  fillPercent: number; // 0-100
  color: string;
  delay?: number;
}> = ({ x, y, width, maxHeight, fillPercent, color, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const height = interpolate(
    entrance,
    [0, 1],
    [0, (fillPercent / 100) * maxHeight],
    { extrapolateRight: "clamp" }
  );

  const glowIntensity = interpolate(Math.sin(frame * 0.08), [-1, 1], [5, 15]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        bottom: y,
        width,
        height,
        background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
        borderRadius: 4,
        boxShadow: `0 0 ${glowIntensity}px ${color}`,
      }}
    />
  );
};

// Animated counter that counts up
export const AnimatedCounter: React.FC<{
  x: number;
  y: number;
  endValue: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  fontSize?: number;
  color?: string;
}> = ({
  x,
  y,
  endValue,
  prefix = "",
  suffix = "",
  delay = 0,
  fontSize = 32,
  color = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(
    frame - delay,
    [0, 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  const currentValue = Math.round(progress * endValue);
  const scale = interpolate(progress, [0, 0.5, 1], [0.8, 1.1, 1]);
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: "Inter, sans-serif",
        fontSize,
        fontWeight: 800,
        color,
        opacity,
        transform: `scale(${scale})`,
        textShadow: `0 0 20px ${color}66`,
      }}
    >
      {prefix}{currentValue.toLocaleString()}{suffix}
    </div>
  );
};

// Light streak effect
export const LightStreak: React.FC<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  delay?: number;
  duration?: number;
}> = ({
  startX,
  startY,
  endX,
  endY,
  color = "#6366f1",
  delay = 0,
  duration = 30,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame - delay,
    [0, duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const currentX = interpolate(progress, [0, 1], [startX, endX]);
  const currentY = interpolate(progress, [0, 1], [startY, endY]);

  const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
  const length = interpolate(progress, [0, 0.3, 1], [0, 150, 50]);

  if (frame < delay || progress >= 1) return null;

  const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

  return (
    <div
      style={{
        position: "absolute",
        left: currentX,
        top: currentY,
        width: length,
        height: 3,
        background: `linear-gradient(90deg, ${color}, transparent)`,
        opacity,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "left center",
        filter: `blur(1px)`,
        boxShadow: `0 0 20px ${color}`,
      }}
    />
  );
};

// Floating geometric shapes
export const FloatingShape: React.FC<{
  x: number;
  y: number;
  size: number;
  shape: "circle" | "square" | "triangle" | "hexagon";
  color: string;
  delay?: number;
  rotationSpeed?: number;
}> = ({ x, y, size, shape, color, delay = 0, rotationSpeed = 0.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 0.6], { extrapolateRight: "clamp" });
  const scale = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  const floatY = Math.sin((frame - delay) * 0.03) * 15;
  const floatX = Math.cos((frame - delay) * 0.02) * 10;
  const rotation = (frame - delay) * rotationSpeed;

  const getShapePath = () => {
    switch (shape) {
      case "triangle":
        return "polygon(50% 0%, 0% 100%, 100% 100%)";
      case "hexagon":
        return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
      case "square":
        return "none";
      default:
        return "none";
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: x + floatX,
        top: y + floatY,
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}40, ${color}10)`,
        border: `1px solid ${color}60`,
        borderRadius: shape === "circle" ? "50%" : shape === "square" ? 8 : 0,
        clipPath: shape === "triangle" || shape === "hexagon" ? getShapePath() : "none",
        opacity,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        boxShadow: `0 0 30px ${color}30`,
      }}
    />
  );
};

// Data point that pulses
export const DataPoint: React.FC<{
  x: number;
  y: number;
  color: string;
  delay?: number;
  size?: number;
}> = ({ x, y, color, delay = 0, size = 12 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const pulseScale = interpolate(Math.sin(frame * 0.15), [-1, 1], [1, 1.3]);
  const pulseOpacity = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 0.8]);

  return (
    <>
      {/* Pulse ring */}
      <div
        style={{
          position: "absolute",
          left: x - size,
          top: y - size,
          width: size * 2,
          height: size * 2,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: pulseOpacity * scale,
          transform: `scale(${pulseScale})`,
        }}
      />
      {/* Core dot */}
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 20px ${color}`,
          transform: `scale(${scale})`,
        }}
      />
    </>
  );
};

// Connecting line between points
export const ConnectingLine: React.FC<{
  points: { x: number; y: number }[];
  color: string;
  delay?: number;
  strokeWidth?: number;
}> = ({ points, color, delay = 0, strokeWidth = 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (points.length < 2) return null;

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const pathLength = points.reduce((acc, point, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return acc + Math.sqrt((point.x - prev.x) ** 2 + (point.y - prev.y) ** 2);
  }, 0);

  const animatedLength = interpolate(entrance, [0, 1], [0, pathLength], {
    extrapolateRight: "clamp",
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <defs>
        <linearGradient id={`lineGrad-${delay}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={`url(#lineGrad-${delay})`}
        strokeWidth={strokeWidth}
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength - animatedLength}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
};

// Particle explosion effect
export const ParticleExplosion: React.FC<{
  x: number;
  y: number;
  color: string;
  delay?: number;
  particleCount?: number;
}> = ({ x, y, color, delay = 0, particleCount = 12 }) => {
  const frame = useCurrentFrame();

  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2,
      speed: 3 + Math.random() * 4,
      size: 4 + Math.random() * 6,
    }));
  }, [particleCount]);

  const localFrame = frame - delay;
  if (localFrame < 0 || localFrame > 40) return null;

  const progress = localFrame / 40;

  return (
    <>
      {particles.map((particle, i) => {
        const distance = particle.speed * localFrame;
        const px = x + Math.cos(particle.angle) * distance;
        const py = y + Math.sin(particle.angle) * distance;
        const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 0]);
        const scale = interpolate(progress, [0, 0.2, 1], [0, 1, 0.3]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px - particle.size / 2,
              top: py - particle.size / 2,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              background: color,
              opacity,
              transform: `scale(${scale})`,
              boxShadow: `0 0 10px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

// Glowing orb with trail
export const GlowingOrb: React.FC<{
  path: { x: number; y: number }[];
  color: string;
  delay?: number;
  duration?: number;
  size?: number;
}> = ({ path, color, delay = 0, duration = 60, size = 20 }) => {
  const frame = useCurrentFrame();

  const localFrame = frame - delay;
  if (localFrame < 0 || localFrame > duration) return null;

  const progress = localFrame / duration;
  const pathIndex = Math.floor(progress * (path.length - 1));
  const nextIndex = Math.min(pathIndex + 1, path.length - 1);
  const segmentProgress = (progress * (path.length - 1)) % 1;

  const currentX = interpolate(segmentProgress, [0, 1], [path[pathIndex].x, path[nextIndex].x]);
  const currentY = interpolate(segmentProgress, [0, 1], [path[pathIndex].y, path[nextIndex].y]);

  const glowSize = interpolate(Math.sin(localFrame * 0.2), [-1, 1], [size, size * 1.5]);

  return (
    <div
      style={{
        position: "absolute",
        left: currentX - glowSize / 2,
        top: currentY - glowSize / 2,
        width: glowSize,
        height: glowSize,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        boxShadow: `0 0 40px ${color}, 0 0 80px ${color}50`,
      }}
    />
  );
};
