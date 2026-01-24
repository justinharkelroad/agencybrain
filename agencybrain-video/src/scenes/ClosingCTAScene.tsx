import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const ClosingCTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === LOGO ENTRANCE ===
  const logoEntrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const logoScale = interpolate(logoEntrance, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const logoOpacity = interpolate(logoEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // === HEADLINE ENTRANCE ===
  const headlineDelay = 15;
  const headlineEntrance = spring({
    frame: frame - headlineDelay,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const headlineOpacity = interpolate(headlineEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const headlineScale = interpolate(headlineEntrance, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const headlineY = interpolate(headlineEntrance, [0, 1], [40, 0], {
    extrapolateRight: "clamp",
  });

  // === SUBTITLE ENTRANCE ===
  const subtitleDelay = 30;
  const subtitleEntrance = spring({
    frame: frame - subtitleDelay,
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  const subtitleOpacity = interpolate(subtitleEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // === FEATURE PILLS ===
  const features = [
    { icon: "📊", text: "7 Dashboard Views" },
    { icon: "🎯", text: "AI Call Scoring" },
    { icon: "📈", text: "Lead Pipeline" },
    { icon: "💰", text: "Comp Analysis" },
    { icon: "📚", text: "Custom Training" },
    { icon: "🎯", text: "Goal Tracking" },
  ];

  // === CTA BUTTON ENTRANCE ===
  const buttonDelay = 70;
  const buttonEntrance = spring({
    frame: frame - buttonDelay,
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const buttonOpacity = interpolate(buttonEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const buttonScale = interpolate(buttonEntrance, [0, 1], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  // === LINE ANIMATION ===
  const lineDelay = 90;
  const lineEntrance = spring({
    frame: frame - lineDelay,
    fps,
    config: { damping: 25, stiffness: 100 },
  });

  const lineWidth = interpolate(lineEntrance, [0, 1], [0, 500], {
    extrapolateRight: "clamp",
  });

  // === BACKGROUND GLOW (subtle navy blue) ===
  const bgGlow = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.15, 0.3]);
  const bgGlow2 = interpolate(Math.sin(frame * 0.025 + 1), [-1, 1], [0.1, 0.25]);

  // === CORNER RAYS ===
  const rayCount = 8;
  const rays = Array.from({ length: rayCount }).map((_, i) => {
    const rayDelay = 20 + i * 4;
    const rayProgress = spring({
      frame: frame - rayDelay,
      fps,
      config: { damping: 30, stiffness: 80 },
    });
    return { progress: rayProgress, index: i };
  });

  // === STAR FIELD ===
  const stars = Array.from({ length: 50 }).map((_, i) => {
    const x = (i * 137.5) % 100;
    const y = (i * 89.3) % 100;
    const size = 1 + (i % 2);
    const twinkle = interpolate(
      Math.sin(frame * 0.05 + i * 0.8),
      [-1, 1],
      [0.1, 0.5]
    );
    return { x, y, size, opacity: twinkle };
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #080810 0%, #0a0a18 30%, #0d0d20 50%, #0a0a18 70%, #080810 100%)",
      }}
    >
      {/* Star field */}
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: star.opacity,
          }}
        />
      ))}

      {/* Corner glows - Navy blue theme */}
      <div
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 600,
          height: 600,
          background: `radial-gradient(ellipse, rgba(30, 64, 175, ${bgGlow}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -150,
          right: -150,
          width: 600,
          height: 600,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${bgGlow2}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -150,
          left: -150,
          width: 600,
          height: 600,
          background: `radial-gradient(ellipse, rgba(37, 99, 235, ${bgGlow2}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -150,
          right: -150,
          width: 600,
          height: 600,
          background: `radial-gradient(ellipse, rgba(30, 64, 175, ${bgGlow}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />

      {/* Center top glow */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 1000,
          height: 500,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${bgGlow * 0.8}) 0%, transparent 70%)`,
          filter: "blur(100px)",
        }}
      />

      {/* Light rays from corners */}
      {rays.map((ray, i) => {
        const isLeft = i < 4;
        const isTop = i % 4 < 2;
        const angle = isLeft
          ? (isTop ? 30 + (i % 2) * 15 : 330 - (i % 2) * 15)
          : (isTop ? 150 - (i % 2) * 15 : 210 + (i % 2) * 15);

        const rayLength = interpolate(ray.progress, [0, 1], [0, 400], { extrapolateRight: "clamp" });
        const rayOpacity = interpolate(ray.progress, [0, 0.5, 1], [0, 0.3, 0.15], { extrapolateRight: "clamp" });

        return (
          <div
            key={`ray-${i}`}
            style={{
              position: "absolute",
              ...(isLeft ? { left: 0 } : { right: 0 }),
              ...(isTop ? { top: 0 } : { bottom: 0 }),
              width: 3,
              height: rayLength,
              background: `linear-gradient(to top, rgba(59, 130, 246, ${rayOpacity}) 0%, transparent 100%)`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "center bottom",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Main content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 100px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginBottom: 40,
          }}
        >
          <Img
            src={staticFile("AGENCYBRAIN LOGO FINAL.png")}
            style={{
              width: 320,
              height: "auto",
              filter: "drop-shadow(0 0 30px rgba(59, 130, 246, 0.4))",
            }}
          />
        </div>

        {/* Main Headline - "Run Your Agency Smarter" with gradient */}
        <div
          style={{
            opacity: headlineOpacity,
            transform: `scale(${headlineScale}) translateY(${headlineY}px)`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 100,
              fontWeight: 800,
              background: "linear-gradient(90deg, #ffffff 0%, #60a5fa 30%, #3b82f6 50%, #a78bfa 80%, #c084fc 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textAlign: "center",
              letterSpacing: -1,
              textShadow: "none",
              filter: "drop-shadow(0 0 40px rgba(59, 130, 246, 0.3))",
            }}
          >
            Run Your Agency Smarter
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subtitleOpacity,
            marginBottom: 50,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 42,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.85)",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Everything you need. One powerful platform.
          </div>
        </div>

        {/* Feature pills - two rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginBottom: 50,
          }}
        >
          {/* Row 1 */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {features.slice(0, 3).map((feature, i) => {
              const pillDelay = 45 + i * 5;
              const pillEntrance = spring({
                frame: frame - pillDelay,
                fps,
                config: { damping: 12, stiffness: 180 },
              });

              const pillOpacity = interpolate(pillEntrance, [0, 1], [0, 1], {
                extrapolateRight: "clamp",
              });

              const pillScale = interpolate(pillEntrance, [0, 1], [0.7, 1], {
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontFamily,
                    fontSize: 24,
                    fontWeight: 600,
                    color: "#ffffff",
                    background: "rgba(59, 130, 246, 0.12)",
                    padding: "14px 28px",
                    borderRadius: 100,
                    border: "1px solid rgba(59, 130, 246, 0.25)",
                    opacity: pillOpacity,
                    transform: `scale(${pillScale})`,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{feature.icon}</span>
                  {feature.text}
                </div>
              );
            })}
          </div>

          {/* Row 2 */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {features.slice(3, 6).map((feature, i) => {
              const pillDelay = 55 + i * 5;
              const pillEntrance = spring({
                frame: frame - pillDelay,
                fps,
                config: { damping: 12, stiffness: 180 },
              });

              const pillOpacity = interpolate(pillEntrance, [0, 1], [0, 1], {
                extrapolateRight: "clamp",
              });

              const pillScale = interpolate(pillEntrance, [0, 1], [0.7, 1], {
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontFamily,
                    fontSize: 24,
                    fontWeight: 600,
                    color: "#ffffff",
                    background: "rgba(59, 130, 246, 0.12)",
                    padding: "14px 28px",
                    borderRadius: 100,
                    border: "1px solid rgba(59, 130, 246, 0.25)",
                    opacity: pillOpacity,
                    transform: `scale(${pillScale})`,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{feature.icon}</span>
                  {feature.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Button - gradient with navy blues to purple accent */}
        <div
          style={{
            opacity: buttonOpacity,
            transform: `scale(${buttonScale})`,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 26,
              fontWeight: 700,
              color: "#ffffff",
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 30%, #6366f1 60%, #8b5cf6 100%)",
              padding: "24px 70px",
              borderRadius: 100,
              textTransform: "uppercase",
              letterSpacing: 4,
              boxShadow: "0 4px 30px rgba(59, 130, 246, 0.5), 0 0 60px rgba(59, 130, 246, 0.2)",
            }}
          >
            Standard Playbook Exclusive
          </div>
        </div>

        {/* Animated underline - navy blue gradient */}
        <div
          style={{
            marginTop: 30,
            height: 3,
            borderRadius: 2,
            background: "linear-gradient(90deg, transparent, #1e40af, #3b82f6, #60a5fa, transparent)",
            width: lineWidth,
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
          }}
        />
      </AbsoluteFill>

      {/* Subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
