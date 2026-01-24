import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { GradientText, TypewriterText } from "../components/AnimatedText";
import { ParticleBackground, GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "800"],
  subsets: ["latin"],
});

export const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance animation
  const logoEntrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const logoScale = interpolate(logoEntrance, [0, 1], [0.5, 1], {
    extrapolateRight: "clamp",
  });

  const logoOpacity = interpolate(logoEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulsing glow effect on logo
  const glowIntensity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [20, 40]
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)",
      }}
    >
      {/* Animated background elements */}
      <GridBackground opacity={0.08} />
      <ParticleBackground color="#6366f1" particleCount={40} />

      {/* Floating gradient orbs */}
      <GradientOrb x={200} y={150} size={300} color1="#6366f1" color2="#8b5cf6" delay={0} />
      <GradientOrb x={1400} y={600} size={400} color1="#d946ef" color2="#8b5cf6" delay={30} />
      <GradientOrb x={800} y={800} size={250} color1="#22d3ee" color2="#6366f1" delay={60} />

      {/* Main content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 30,
        }}
      >
        {/* Logo/Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          {/* Brain icon representation */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 24,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 ${glowIntensity}px rgba(99, 102, 241, 0.6)`,
            }}
          >
            <span style={{ fontSize: 56 }}>🧠</span>
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: -2,
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
        <div style={{ marginTop: 20 }}>
          <GradientText
            text="The Operating System for Insurance Agencies"
            delay={30}
            fontSize={36}
            fontWeight="600"
            gradient="linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.8) 100%)"
          />
        </div>

        {/* Hook question */}
        <div style={{ marginTop: 40 }}>
          <TypewriterText
            text="What if your entire agency ran smarter?"
            delay={60}
            fontSize={28}
            fontWeight="400"
            color="rgba(255,255,255,0.7)"
          />
        </div>

        {/* Animated line underneath */}
        <div
          style={{
            marginTop: 30,
            height: 2,
            background: "linear-gradient(90deg, transparent, #6366f1, #8b5cf6, #d946ef, transparent)",
            width: interpolate(
              spring({ frame: frame - 90, fps, config: { damping: 200 } }),
              [0, 1],
              [0, 600],
              { extrapolateRight: "clamp" }
            ),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
