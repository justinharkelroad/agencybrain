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
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === DRAMATIC LOGO ENTRANCE ===

  // Phase 1: Logo zooms in from far away with scale overshoot
  const logoZoomIn = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });

  // Logo starts tiny, overshoots past 1, then settles
  const logoScale = interpolate(logoZoomIn, [0, 1], [0.1, 1], {
    extrapolateRight: "clamp",
  });

  // Pop/bounce effect after initial entrance
  const popDelay = 20;
  const popEffect = spring({
    frame: frame - popDelay,
    fps,
    config: { damping: 8, stiffness: 300 },
  });

  const popScale = frame > popDelay
    ? interpolate(popEffect, [0, 1], [1, 1.15], { extrapolateRight: "clamp" })
    : 1;

  // Settle back with a gentle bounce
  const settleDelay = 35;
  const settleEffect = spring({
    frame: frame - settleDelay,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const settleScale = frame > settleDelay
    ? interpolate(settleEffect, [0, 1], [1.15, 1.05], { extrapolateRight: "clamp" })
    : popScale;

  const finalLogoScale = frame > settleDelay ? settleScale : (frame > popDelay ? popScale : logoScale);

  const logoOpacity = interpolate(logoZoomIn, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Logo rotation for extra drama on entrance
  const logoRotation = interpolate(logoZoomIn, [0, 0.5, 1], [15, -5, 0], {
    extrapolateRight: "clamp",
  });

  // === LIGHT BURST ON POP ===
  const burstOpacity = frame > popDelay && frame < popDelay + 15
    ? interpolate(frame - popDelay, [0, 5, 15], [0, 1, 0])
    : 0;

  const burstScale = frame > popDelay
    ? interpolate(frame - popDelay, [0, 15], [0.5, 2.5], { extrapolateRight: "clamp" })
    : 0;

  // === RADIAL LIGHT RAYS ===
  const rayCount = 12;
  const rays = Array.from({ length: rayCount }).map((_, i) => {
    const angle = (360 / rayCount) * i;
    const rayDelay = popDelay + (i * 0.5);
    const rayProgress = spring({
      frame: frame - rayDelay,
      fps,
      config: { damping: 20, stiffness: 150 },
    });
    return { angle, progress: rayProgress };
  });

  // === PULSING GLOW (continuous after entrance) ===
  const continuousGlow = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [30, 60]
  );

  // === FLOATING PARTICLES around logo ===
  const particles = Array.from({ length: 20 }).map((_, i) => {
    const angle = (360 / 20) * i + frame * 0.5;
    const radius = 180 + Math.sin(frame * 0.05 + i) * 30;
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    const particleDelay = 25 + i * 2;
    const particleOpacity = frame > particleDelay
      ? interpolate(frame - particleDelay, [0, 20], [0, 0.6], { extrapolateRight: "clamp" })
      : 0;
    const size = 2 + (i % 3);
    return { x, y, opacity: particleOpacity, size };
  });

  // === BADGE TEXT - "Standard Playbook Exclusive" ===
  const badgeDelay = 50;
  const badgeEntrance = spring({
    frame: frame - badgeDelay,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const badgeOpacity = interpolate(badgeEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const badgeY = interpolate(badgeEntrance, [0, 1], [30, 0], {
    extrapolateRight: "clamp",
  });

  // Letter-by-letter animation for badge
  const badgeText = "STANDARD PLAYBOOK EXCLUSIVE";

  // === BACKGROUND GLOW (navy blue theme) ===
  const bgGlow1 = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.2, 0.45]);
  const bgGlow2 = interpolate(Math.sin(frame * 0.025 + 1), [-1, 1], [0.15, 0.35]);

  // === STAR FIELD ===
  const stars = Array.from({ length: 50 }).map((_, i) => {
    const x = (i * 137.5) % 100;
    const y = (i * 89.3) % 100;
    const size = 1 + (i % 2);
    const twinkle = interpolate(
      Math.sin(frame * 0.06 + i * 0.7),
      [-1, 1],
      [0.1, 0.5]
    );
    return { x, y, size, opacity: twinkle };
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a12 0%, #12121f 50%, #0a0a12 100%)",
      }}
    >
      {/* Star field background */}
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

      {/* Soft ambient glows - Navy blue theme */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${bgGlow1}) 0%, transparent 70%)`,
          filter: "blur(100px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "30%",
          width: 400,
          height: 300,
          background: `radial-gradient(ellipse, rgba(30, 64, 175, ${bgGlow2}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "25%",
          width: 350,
          height: 250,
          background: `radial-gradient(ellipse, rgba(37, 99, 235, ${bgGlow2 * 0.8}) 0%, transparent 70%)`,
          filter: "blur(70px)",
        }}
      />

      {/* Main content - centered */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Light burst effect on pop */}
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(59, 130, 246, 0.4) 30%, transparent 70%)",
            transform: `scale(${burstScale})`,
            opacity: burstOpacity,
            filter: "blur(10px)",
          }}
        />

        {/* Radial light rays */}
        {rays.map((ray, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 4,
              height: interpolate(ray.progress, [0, 1], [0, 250], { extrapolateRight: "clamp" }),
              background: `linear-gradient(to top, rgba(59, 130, 246, ${0.6 * ray.progress}) 0%, transparent 100%)`,
              transform: `rotate(${ray.angle}deg)`,
              transformOrigin: "center bottom",
              opacity: ray.progress * 0.7,
            }}
          />
        ))}

        {/* Floating particles around logo */}
        {particles.map((particle, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              background: i % 2 === 0 ? "#3b82f6" : "#60a5fa",
              transform: `translate(${particle.x}px, ${particle.y}px)`,
              opacity: particle.opacity,
              boxShadow: `0 0 ${particle.size * 3}px ${i % 2 === 0 ? "#3b82f6" : "#60a5fa"}`,
            }}
          />
        ))}

        {/* Glow behind logo */}
        <div
          style={{
            position: "absolute",
            width: 350,
            height: 350,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
            filter: `blur(40px)`,
            transform: `scale(${finalLogoScale})`,
            opacity: logoOpacity,
          }}
        />

        {/* LOGO with dramatic entrance */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${finalLogoScale}) rotate(${logoRotation}deg)`,
            filter: `drop-shadow(0 0 ${continuousGlow}px rgba(59, 130, 246, 0.6))`,
          }}
        >
          <Img
            src={staticFile("AGENCYBRAIN LOGO FINAL.png")}
            style={{
              width: 700,
              height: "auto",
            }}
          />
        </div>

        {/* Standard Playbook Exclusive - clean text, no bubble */}
        <div
          style={{
            marginTop: 60,
            opacity: badgeOpacity,
            transform: `translateY(${badgeY}px)`,
            display: "flex",
            gap: 6,
          }}
        >
          {badgeText.split("").map((letter, i) => {
            const letterDelay = badgeDelay + i * 1.5;
            const letterEntrance = spring({
              frame: frame - letterDelay,
              fps,
              config: { damping: 15, stiffness: 200 },
            });

            const letterOpacity = interpolate(letterEntrance, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            });

            const letterY = interpolate(letterEntrance, [0, 1], [20, 0], {
              extrapolateRight: "clamp",
            });

            return (
              <span
                key={i}
                style={{
                  fontFamily,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#60a5fa",
                  letterSpacing: letter === " " ? 16 : 6,
                  opacity: letterOpacity,
                  transform: `translateY(${letterY}px)`,
                  textShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
                }}
              >
                {letter === " " ? "\u00A0" : letter}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
