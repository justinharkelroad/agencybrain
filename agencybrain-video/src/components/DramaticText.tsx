import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// Explosive text entrance - letters fly in from different directions
export const ExplosiveText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
}> = ({
  text,
  delay = 0,
  fontSize = 72,
  color = "#ffffff",
  glowColor = "#6366f1",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const letters = text.split("");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        fontSize,
        fontWeight: 900,
      }}
    >
      {letters.map((letter, i) => {
        const letterDelay = delay + i * 2;
        const entrance = spring({
          frame: frame - letterDelay,
          fps,
          config: { damping: 12, stiffness: 150 },
        });

        // Random direction for each letter
        const angle = ((i * 137.5) % 360) * (Math.PI / 180);
        const distance = 200;
        const startX = Math.cos(angle) * distance;
        const startY = Math.sin(angle) * distance;

        const x = interpolate(entrance, [0, 1], [startX, 0], { extrapolateRight: "clamp" });
        const y = interpolate(entrance, [0, 1], [startY, 0], { extrapolateRight: "clamp" });
        const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
        const scale = interpolate(entrance, [0, 1], [2, 1], { extrapolateRight: "clamp" });
        const rotation = interpolate(entrance, [0, 1], [(i % 2 === 0 ? 1 : -1) * 180, 0], {
          extrapolateRight: "clamp",
        });

        const glowIntensity = interpolate(
          Math.sin((frame - letterDelay) * 0.1),
          [-1, 1],
          [10, 30]
        );

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color,
              opacity,
              transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`,
              textShadow: entrance > 0.5 ? `0 0 ${glowIntensity}px ${glowColor}` : "none",
              marginRight: letter === " " ? "0.3em" : 0,
            }}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        );
      })}
    </div>
  );
};

// Wave text - letters animate in a wave pattern
export const WaveText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  waveHeight?: number;
}> = ({
  text,
  delay = 0,
  fontSize = 48,
  color = "#ffffff",
  waveHeight = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const letters = text.split("");

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        fontSize,
        fontWeight: 700,
        opacity,
      }}
    >
      {letters.map((letter, i) => {
        const waveOffset = Math.sin((frame - delay) * 0.1 + i * 0.5) * waveHeight * entrance;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color,
              transform: `translateY(${waveOffset}px)`,
              marginRight: letter === " " ? "0.3em" : 0,
            }}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        );
      })}
    </div>
  );
};

// Glitch text effect
export const GlitchText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
}> = ({ text, delay = 0, fontSize = 64, color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(entrance, [0, 1], [0.9, 1], { extrapolateRight: "clamp" });

  // Glitch offsets - only active occasionally
  const glitchActive = Math.sin(frame * 0.3) > 0.7;
  const glitchX = glitchActive ? (Math.random() - 0.5) * 10 : 0;
  const glitchY = glitchActive ? (Math.random() - 0.5) * 5 : 0;

  return (
    <div
      style={{
        position: "relative",
        fontFamily,
        fontSize,
        fontWeight: 900,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Cyan offset */}
      <span
        style={{
          position: "absolute",
          color: "#00ffff",
          left: glitchActive ? -3 + glitchX : 0,
          top: glitchY,
          opacity: glitchActive ? 0.8 : 0,
          mixBlendMode: "screen",
        }}
      >
        {text}
      </span>
      {/* Magenta offset */}
      <span
        style={{
          position: "absolute",
          color: "#ff00ff",
          left: glitchActive ? 3 - glitchX : 0,
          top: -glitchY,
          opacity: glitchActive ? 0.8 : 0,
          mixBlendMode: "screen",
        }}
      >
        {text}
      </span>
      {/* Main text */}
      <span style={{ color, position: "relative" }}>{text}</span>
    </div>
  );
};

// Typewriter with cursor and glow
export const GlowingTypewriter: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  speed?: number;
}> = ({
  text,
  delay = 0,
  fontSize = 32,
  color = "#ffffff",
  glowColor = "#6366f1",
  speed = 2,
}) => {
  const frame = useCurrentFrame();

  const localFrame = Math.max(0, frame - delay);
  const charsToShow = Math.min(text.length, Math.floor(localFrame / speed));
  const displayText = text.slice(0, charsToShow);

  const cursorBlink = Math.floor(frame / 15) % 2 === 0;
  const glowIntensity = interpolate(Math.sin(frame * 0.1), [-1, 1], [15, 35]);

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight: 600,
        color,
        textShadow: `0 0 ${glowIntensity}px ${glowColor}`,
      }}
    >
      {displayText}
      <span
        style={{
          opacity: cursorBlink && charsToShow < text.length ? 1 : 0,
          color: glowColor,
          textShadow: `0 0 20px ${glowColor}`,
        }}
      >
        |
      </span>
    </div>
  );
};

// Scale and fade text
export const ScaleFadeText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
}> = ({
  text,
  delay = 0,
  fontSize = 56,
  color = "#ffffff",
  glowColor = "#6366f1",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const scale = interpolate(entrance, [0, 1], [0.5, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(entrance, [0, 1], [10, 0], { extrapolateRight: "clamp" });

  const glowIntensity = interpolate(entrance, [0, 1], [0, 30]);

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight: 800,
        color,
        opacity,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        textShadow: `0 0 ${glowIntensity}px ${glowColor}`,
      }}
    >
      {text}
    </div>
  );
};

// Slide up reveal with mask
export const SlideUpReveal: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
}> = ({ text, delay = 0, fontSize = 48, color = "#ffffff", lineHeight = 1.2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = text.split("\n");

  return (
    <div style={{ overflow: "hidden" }}>
      {lines.map((line, i) => {
        const lineDelay = delay + i * 10;
        const entrance = spring({
          frame: frame - lineDelay,
          fps,
          config: { damping: 200 },
        });

        const y = interpolate(entrance, [0, 1], [fontSize * lineHeight, 0], {
          extrapolateRight: "clamp",
        });
        const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });

        return (
          <div
            key={i}
            style={{
              fontFamily,
              fontSize,
              fontWeight: 700,
              color,
              lineHeight,
              transform: `translateY(${y}px)`,
              opacity,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

// Gradient animated text
export const GradientAnimatedText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  gradientColors?: string[];
}> = ({
  text,
  delay = 0,
  fontSize = 64,
  gradientColors = ["#6366f1", "#8b5cf6", "#d946ef", "#6366f1"],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(entrance, [0, 1], [0.9, 1], { extrapolateRight: "clamp" });

  // Animate gradient position
  const gradientOffset = (frame - delay) * 2;

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight: 900,
        background: `linear-gradient(90deg, ${gradientColors.join(", ")})`,
        backgroundSize: "200% 100%",
        backgroundPosition: `${gradientOffset}% 0`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        opacity,
        transform: `scale(${scale})`,
        filter: `drop-shadow(0 0 30px ${gradientColors[0]}50)`,
      }}
    >
      {text}
    </div>
  );
};

// Feature label with icon
export const FeatureLabel: React.FC<{
  icon: string;
  text: string;
  delay?: number;
  color?: string;
}> = ({ icon, text, delay = 0, color = "#6366f1" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}20`,
          border: `1px solid ${color}50`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontFamily,
          fontSize: 20,
          fontWeight: 600,
          color: "#ffffff",
        }}
      >
        {text}
      </span>
    </div>
  );
};

// Big stat display
export const BigStat: React.FC<{
  value: string;
  label: string;
  delay?: number;
  color?: string;
}> = ({ value, label, delay = 0, color = "#6366f1" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const scale = interpolate(entrance, [0, 1], [0.5, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  const glowIntensity = interpolate(Math.sin(frame * 0.08), [-1, 1], [20, 40]);

  return (
    <div
      style={{
        textAlign: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: 80,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${color}, ${color}aa)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: `drop-shadow(0 0 ${glowIntensity}px ${color})`,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 18,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          letterSpacing: 3,
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
};
