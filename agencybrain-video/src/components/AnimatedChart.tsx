import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

type BarChartProps = {
  data: { label: string; value: number; color: string }[];
  delay?: number;
  maxValue?: number;
};

export const AnimatedBarChart: React.FC<BarChartProps> = ({
  data,
  delay = 0,
  maxValue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const max = maxValue || Math.max(...data.map((d) => d.value));
  const STAGGER_DELAY = 5;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 24,
        height: 250,
        padding: "0 20px",
      }}
    >
      {data.map((item, i) => {
        const barEntrance = spring({
          frame: frame - delay,
          fps,
          delay: i * STAGGER_DELAY,
          config: { damping: 200 },
        });

        const height = interpolate(barEntrance, [0, 1], [0, (item.value / max) * 200], {
          extrapolateRight: "clamp",
        });

        const labelOpacity = interpolate(barEntrance, [0.5, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 14,
                fontWeight: 600,
                color: "#ffffff",
                opacity: labelOpacity,
              }}
            >
              {item.value}%
            </div>
            <div
              style={{
                width: 50,
                height,
                background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}66 100%)`,
                borderRadius: "8px 8px 0 0",
                boxShadow: `0 0 30px ${item.color}40`,
              }}
            />
            <div
              style={{
                fontFamily,
                fontSize: 12,
                fontWeight: 400,
                color: "rgba(255,255,255,0.7)",
                opacity: labelOpacity,
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

type PerformanceRingProps = {
  percentage: number;
  label: string;
  color: string;
  delay?: number;
  size?: number;
};

export const PerformanceRing: React.FC<PerformanceRingProps> = ({
  percentage,
  label,
  color,
  delay = 0,
  size = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 60,
  });

  const circumference = 2 * Math.PI * (size / 2 - 8);
  const strokeDashoffset = interpolate(
    entrance,
    [0, 1],
    [circumference, circumference * (1 - percentage / 100)],
    { extrapolateRight: "clamp" }
  );

  const scale = interpolate(entrance, [0, 0.3], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const displayPercentage = Math.round(interpolate(entrance, [0, 1], [0, percentage], {
    extrapolateRight: "clamp",
  }));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        transform: `scale(${scale})`,
      }}
    >
      <svg width={size} height={size}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 8}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={8}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 8}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            filter: `drop-shadow(0 0 10px ${color})`,
          }}
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontFamily={fontFamily}
          fontSize={size / 4}
          fontWeight={700}
        >
          {displayPercentage}%
        </text>
      </svg>
      <div
        style={{
          fontFamily,
          fontSize: 14,
          fontWeight: 600,
          color: "rgba(255,255,255,0.8)",
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
};

type LineGraphProps = {
  delay?: number;
};

export const AnimatedLineGraph: React.FC<LineGraphProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 60,
  });

  const points = [
    { x: 0, y: 80 },
    { x: 60, y: 60 },
    { x: 120, y: 70 },
    { x: 180, y: 40 },
    { x: 240, y: 50 },
    { x: 300, y: 25 },
    { x: 360, y: 30 },
    { x: 420, y: 15 },
  ];

  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const pathLength = 600;
  const dashOffset = interpolate(entrance, [0, 1], [pathLength, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <svg width={450} height={120} style={{ overflow: "visible" }}>
      {/* Grid lines */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={0}
          y1={i * 30}
          x2={420}
          y2={i * 30}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
      ))}
      {/* Gradient fill */}
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path
        d={`${pathData} L 420 100 L 0 100 Z`}
        fill="url(#areaGradient)"
        opacity={entrance}
      />
      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        style={{
          filter: "drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))",
        }}
      />
      {/* Data points */}
      {points.map((p, i) => {
        const pointEntrance = spring({
          frame: frame - delay,
          fps,
          delay: i * 5,
          config: { damping: 15, stiffness: 200 },
        });
        const pointScale = interpolate(pointEntrance, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={6 * pointScale}
            fill="#8b5cf6"
            stroke="#ffffff"
            strokeWidth={2}
            style={{
              filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.8))",
            }}
          />
        );
      })}
    </svg>
  );
};
