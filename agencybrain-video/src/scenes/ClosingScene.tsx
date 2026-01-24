import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { GradientText, AnimatedText } from "../components/AnimatedText";
import { ParticleBackground, GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance with bounce
  const logoEntrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const logoScale = interpolate(logoEntrance, [0, 1], [0.3, 1], {
    extrapolateRight: "clamp",
  });

  const logoOpacity = interpolate(logoEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulsing glow
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [25, 50]
  );

  // CTA button animation
  const ctaEntrance = spring({
    frame: frame - 40,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const ctaScale = interpolate(ctaEntrance, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const ctaOpacity = interpolate(ctaEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle floating animation for CTA
  const ctaFloat = Math.sin(frame * 0.05) * 3;

  // Features summary animation
  const features = ["Smart Analytics", "AI Coaching", "Team Growth", "Full Visibility"];

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 70%)",
      }}
    >
      {/* Background effects */}
      <GridBackground opacity={0.05} />
      <ParticleBackground color="#6366f1" particleCount={60} />

      {/* Multiple gradient orbs for dramatic effect */}
      <GradientOrb x={960} y={400} size={800} color1="#6366f1" color2="#0a0a0f" delay={0} />
      <GradientOrb x={400} y={200} size={300} color1="#8b5cf6" color2="#0a0a0f" delay={20} />
      <GradientOrb x={1500} y={300} size={350} color1="#d946ef" color2="#0a0a0f" delay={40} />
      <GradientOrb x={200} y={700} size={250} color1="#22d3ee" color2="#0a0a0f" delay={60} />
      <GradientOrb x={1700} y={800} size={280} color1="#6366f1" color2="#0a0a0f" delay={30} />

      {/* Main content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 28,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 ${glowIntensity}px rgba(99, 102, 241, 0.7), 0 0 ${glowIntensity * 2}px rgba(139, 92, 246, 0.4)`,
            }}
          >
            <span style={{ fontSize: 70 }}>🧠</span>
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 84,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: -3,
            }}
          >
            Agency
            <span
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Brain
            </span>
          </div>
        </div>

        {/* Tagline */}
        <GradientText
          text="Run a Smarter Agency"
          fontSize={40}
          fontWeight="600"
          delay={20}
          gradient="linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.8) 100%)"
        />

        {/* Features ribbon */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 20,
          }}
        >
          {features.map((feature, i) => {
            const featureEntrance = spring({
              frame: frame - 30,
              fps,
              delay: i * 8,
              config: { damping: 200 },
            });
            const featureOpacity = interpolate(featureEntrance, [0, 1], [0, 1]);
            const featureY = interpolate(featureEntrance, [0, 1], [20, 0]);

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: featureOpacity,
                  transform: `translateY(${featureY}px)`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: ["#6366f1", "#8b5cf6", "#d946ef", "#22d3ee"][i],
                    boxShadow: `0 0 10px ${["#6366f1", "#8b5cf6", "#d946ef", "#22d3ee"][i]}`,
                  }}
                />
                <span
                  style={{
                    fontFamily,
                    fontSize: 18,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {feature}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 40,
            opacity: ctaOpacity,
            transform: `scale(${ctaScale}) translateY(${ctaFloat}px)`,
          }}
        >
          <div
            style={{
              padding: "20px 60px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              borderRadius: 60,
              fontFamily,
              fontSize: 24,
              fontWeight: 700,
              color: "#ffffff",
              boxShadow: `0 0 30px rgba(99, 102, 241, 0.5), 0 10px 40px rgba(99, 102, 241, 0.3)`,
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            Learn More
          </div>
        </div>

        {/* Website */}
        <AnimatedText
          text="agencybrain.io"
          delay={70}
          fontSize={20}
          fontWeight="400"
          color="rgba(255,255,255,0.5)"
          style={{ marginTop: 20 }}
        />
      </AbsoluteFill>

      {/* Animated border glow */}
      <div
        style={{
          position: "absolute",
          inset: 20,
          border: "2px solid transparent",
          borderRadius: 20,
          background: `linear-gradient(#0a0a0f, #0a0a0f) padding-box, linear-gradient(135deg, rgba(99, 102, 241, ${interpolate(Math.sin(frame * 0.05), [-1, 1], [0.1, 0.3])}), rgba(139, 92, 246, ${interpolate(Math.sin(frame * 0.05 + 1), [-1, 1], [0.1, 0.3])}), rgba(217, 70, 239, ${interpolate(Math.sin(frame * 0.05 + 2), [-1, 1], [0.1, 0.3])})) border-box`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
