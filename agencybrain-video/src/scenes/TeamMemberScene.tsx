import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { AnimatedText, GradientText } from "../components/AnimatedText";
import { IconFeature } from "../components/FeatureCard";
import { GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const teamFeatures = [
  { icon: "🎯", label: "Daily Scorecards" },
  { icon: "📞", label: "Call Scoring" },
  { icon: "🏆", label: "Performance Streaks" },
  { icon: "📚", label: "Training Hub" },
  { icon: "🤖", label: "AI Roleplay" },
  { icon: "💪", label: "Core 4 Tracking" },
  { icon: "🎯", label: "Quarterly Goals" },
  { icon: "🔄", label: "Renewals Manager" },
];

export const TeamMemberScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
        background: "linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)",
      }}
    >
      {/* Background elements */}
      <GridBackground opacity={0.05} />
      <GradientOrb x={1400} y={100} size={400} color1="#22d3ee" color2="#0a0a0f" delay={0} />
      <GradientOrb x={100} y={600} size={300} color1="#d946ef" color2="#0a0a0f" delay={30} />

      {/* Section label - right aligned */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 80,
          textAlign: "right",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 14,
            fontWeight: 600,
            color: "#22d3ee",
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 8,
          }}
        >
          For Team Members
        </div>
        <GradientText
          text="Grow Every Day"
          fontSize={56}
          fontWeight="800"
          delay={10}
          gradient="linear-gradient(135deg, #ffffff 0%, #e0ffff 100%)"
        />
        <AnimatedText
          text="Tools that help you level up and hit your goals"
          delay={25}
          fontSize={22}
          fontWeight="400"
          color="rgba(255,255,255,0.6)"
          style={{ marginTop: 12 }}
        />
      </div>

      {/* Features grid - hexagonal-ish layout */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "50%",
          transform: "translateY(-50%)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 40,
          maxWidth: 800,
        }}
      >
        {teamFeatures.map((feature, i) => (
          <Sequence key={i} from={0} premountFor={30}>
            <IconFeature
              icon={feature.icon}
              label={feature.label}
              delay={30 + i * 8}
            />
          </Sequence>
        ))}
      </div>

      {/* Animated progress bar illustration */}
      <div
        style={{
          position: "absolute",
          right: 100,
          bottom: 150,
          width: 400,
        }}
      >
        {["Sales Goals", "Call Targets", "Training Progress"].map((label, i) => {
          const barEntrance = spring({
            frame: frame - 60,
            fps,
            delay: i * 15,
            config: { damping: 200 },
          });
          const barWidth = interpolate(barEntrance, [0, 1], [0, [85, 72, 94][i]], {
            extrapolateRight: "clamp",
          });
          const barOpacity = interpolate(barEntrance, [0, 0.3], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                marginBottom: 20,
                opacity: barOpacity,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#22d3ee",
                  }}
                >
                  {Math.round(barWidth)}%
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, #22d3ee, #6366f1)`,
                    borderRadius: 4,
                    boxShadow: "0 0 20px rgba(34, 211, 238, 0.5)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Corner accent */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 400,
          height: 400,
          background: "radial-gradient(circle at bottom left, rgba(34, 211, 238, 0.1) 0%, transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
};
