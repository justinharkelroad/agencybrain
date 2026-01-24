import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { GradientText } from "../components/AnimatedText";
import { AnimatedBarChart, PerformanceRing, AnimatedLineGraph } from "../components/AnimatedChart";
import { GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const salesData = [
  { label: "Mon", value: 65, color: "#6366f1" },
  { label: "Tue", value: 80, color: "#7c3aed" },
  { label: "Wed", value: 72, color: "#8b5cf6" },
  { label: "Thu", value: 90, color: "#a855f7" },
  { label: "Fri", value: 85, color: "#d946ef" },
];

export const MetricsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const titleOpacity = interpolate(titleEntrance, [0, 1], [0, 1]);

  // Counter animation for the big number
  const counterValue = interpolate(
    spring({ frame: frame - 20, fps, config: { damping: 200 }, durationInFrames: 60 }),
    [0, 1],
    [0, 847],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
      }}
    >
      {/* Background */}
      <GridBackground opacity={0.06} />
      <GradientOrb x={960} y={540} size={600} color1="#6366f1" color2="#0a0a0f" delay={0} />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        <GradientText
          text="Data That Drives Decisions"
          fontSize={48}
          fontWeight="800"
          delay={0}
          gradient="linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)"
        />
      </div>

      {/* Main metrics dashboard layout */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 60,
          right: 60,
          bottom: 60,
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr 1fr",
          gap: 30,
        }}
      >
        {/* Left column - Performance Rings */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 30,
            justifyContent: "center",
            padding: 20,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 16,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Team Performance
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 30 }}>
            <PerformanceRing
              percentage={87}
              label="Calls"
              color="#6366f1"
              delay={20}
              size={100}
            />
            <PerformanceRing
              percentage={92}
              label="Quotes"
              color="#8b5cf6"
              delay={30}
              size={100}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 30 }}>
            <PerformanceRing
              percentage={78}
              label="Sales"
              color="#d946ef"
              delay={40}
              size={100}
            />
            <PerformanceRing
              percentage={95}
              label="Retention"
              color="#22d3ee"
              delay={50}
              size={100}
            />
          </div>
        </div>

        {/* Center column - Main chart and big number */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 30,
          }}
        >
          {/* Big metric card */}
          <div
            style={{
              padding: 30,
              background: "linear-gradient(145deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)",
              borderRadius: 20,
              border: "1px solid rgba(99, 102, 241, 0.3)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              Policies This Month
            </div>
            <div
              style={{
                fontFamily,
                fontSize: 80,
                fontWeight: 800,
                background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {Math.round(counterValue)}
            </div>
            <div
              style={{
                fontFamily,
                fontSize: 16,
                fontWeight: 600,
                color: "#22c55e",
                marginTop: 8,
              }}
            >
              ↑ 23% from last month
            </div>
          </div>

          {/* Line graph */}
          <div
            style={{
              padding: 24,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 16,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                marginBottom: 20,
              }}
            >
              Revenue Trend
            </div>
            <AnimatedLineGraph delay={30} />
          </div>
        </div>

        {/* Right column - Bar chart */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            justifyContent: "center",
            padding: 24,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 16,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
            }}
          >
            Weekly Sales
          </div>
          <AnimatedBarChart data={salesData} delay={25} maxValue={100} />
        </div>
      </div>

      {/* Glowing border effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "1px solid rgba(99, 102, 241, 0.2)",
          borderRadius: 0,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
