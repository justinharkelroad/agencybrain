import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { AnimatedText, GradientText } from "../components/AnimatedText";
import { FeatureCard } from "../components/FeatureCard";
import { GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const ownerFeatures = [
  {
    icon: "📊",
    title: "ROI Analytics",
    description: "Track vendor performance, marketing ROI, and staff productivity",
    color: "#6366f1",
  },
  {
    icon: "💰",
    title: "Compensation Tools",
    description: "Analyze statements, forecast bonuses, and optimize pay structures",
    color: "#8b5cf6",
  },
  {
    icon: "👥",
    title: "Team Management",
    description: "Monitor scorecards, track performance, and develop your staff",
    color: "#d946ef",
  },
  {
    icon: "📈",
    title: "Sales Intelligence",
    description: "Deep insights into leads, quotes, sales, and commissions",
    color: "#22d3ee",
  },
];

export const AgencyOwnerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title entrance
  const titleEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const titleOpacity = interpolate(titleEntrance, [0, 1], [0, 1]);
  const titleY = interpolate(titleEntrance, [0, 1], [-30, 0]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%)",
      }}
    >
      {/* Background elements */}
      <GridBackground opacity={0.05} />
      <GradientOrb x={100} y={100} size={400} color1="#6366f1" color2="#0a0a0f" delay={0} />
      <GradientOrb x={1500} y={500} size={350} color1="#8b5cf6" color2="#0a0a0f" delay={20} />

      {/* Section label */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 14,
            fontWeight: 600,
            color: "#6366f1",
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 8,
          }}
        >
          For Agency Owners
        </div>
        <GradientText
          text="Command Your Agency"
          fontSize={56}
          fontWeight="800"
          delay={10}
          gradient="linear-gradient(135deg, #ffffff 0%, #e0e0ff 100%)"
        />
        <AnimatedText
          text="Complete visibility into every aspect of your business"
          delay={25}
          fontSize={22}
          fontWeight="400"
          color="rgba(255,255,255,0.6)"
          style={{ marginTop: 12 }}
        />
      </div>

      {/* Feature cards grid */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 24,
          padding: "0 60px",
        }}
      >
        {ownerFeatures.map((feature, i) => (
          <Sequence key={i} from={0} premountFor={30}>
            <FeatureCard
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={40 + i * 10}
              accentColor={feature.color}
            />
          </Sequence>
        ))}
      </div>

      {/* Animated connecting lines between features */}
      <svg
        style={{
          position: "absolute",
          bottom: 350,
          left: 0,
          right: 0,
          height: 100,
          pointerEvents: "none",
        }}
        width="100%"
        height="100"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0} />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => {
          const lineEntrance = spring({
            frame: frame - 60,
            fps,
            delay: i * 8,
            config: { damping: 200 },
          });
          const lineWidth = interpolate(lineEntrance, [0, 1], [0, 300], {
            extrapolateRight: "clamp",
          });
          return (
            <line
              key={i}
              x1={350 + i * 350}
              y1={50}
              x2={350 + i * 350 + lineWidth}
              y2={50}
              stroke="url(#lineGrad)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Corner accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 400,
          height: 400,
          background: "radial-gradient(circle at top right, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
};
