import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import React from "react";

type ParticleBackgroundProps = {
  color?: string;
  particleCount?: number;
};

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  color = "#6366f1",
  particleCount = 50,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Generate consistent particle positions based on index
  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      x: (i * 137.5) % width,
      y: (i * 89.3) % height,
      size: 2 + (i % 4),
      speed: 0.3 + (i % 5) * 0.1,
      opacity: 0.1 + (i % 6) * 0.1,
    }));
  }, [particleCount, width, height]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      {particles.map((particle, i) => {
        const yOffset = (frame * particle.speed) % height;
        const y = (particle.y + yOffset) % height;
        const pulseOpacity = interpolate(
          Math.sin(frame * 0.05 + i),
          [-1, 1],
          [particle.opacity * 0.5, particle.opacity]
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: particle.x,
              top: y,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: pulseOpacity,
              boxShadow: `0 0 ${particle.size * 2}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};

export const GradientOrb: React.FC<{
  x: number;
  y: number;
  size: number;
  color1: string;
  color2: string;
  delay?: number;
}> = ({ x, y, size, color1, color2, delay = 0 }) => {
  const frame = useCurrentFrame();

  const floatY = Math.sin((frame + delay) * 0.02) * 20;
  const floatX = Math.cos((frame + delay) * 0.015) * 15;
  const scale = interpolate(
    Math.sin((frame + delay) * 0.03),
    [-1, 1],
    [0.9, 1.1]
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x + floatX,
        top: y + floatY,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${color1}, ${color2})`,
        filter: `blur(${size / 3}px)`,
        opacity: 0.4,
        transform: `scale(${scale})`,
      }}
    />
  );
};

export const GridBackground: React.FC<{ opacity?: number }> = ({
  opacity = 0.1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const gridSize = 60;
  const pulseIntensity = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [opacity * 0.5, opacity]
  );

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <defs>
        <pattern
          id="grid"
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke={`rgba(99, 102, 241, ${pulseIntensity})`}
            strokeWidth={0.5}
          />
        </pattern>
        <radialGradient id="gridFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopOpacity={1} />
          <stop offset="100%" stopOpacity={0} />
        </radialGradient>
        <mask id="gridMask">
          <rect width={width} height={height} fill="url(#gridFade)" />
        </mask>
      </defs>
      <rect
        width={width}
        height={height}
        fill="url(#grid)"
        mask="url(#gridMask)"
      />
    </svg>
  );
};
