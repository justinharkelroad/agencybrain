import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

type AnimatedTextProps = {
  text: string;
  delay?: number;
  fontSize?: number;
  fontWeight?: "400" | "600" | "700" | "800";
  color?: string;
  style?: React.CSSProperties;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  fontSize = 48,
  fontWeight = "600",
  color = "#ffffff",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight,
        color,
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const TypewriterText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  fontSize = 48,
  fontWeight = "600",
  color = "#ffffff",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - delay);
  const charsToShow = Math.min(
    text.length,
    Math.floor(adjustedFrame / (fps / 30))
  );
  const displayText = text.slice(0, charsToShow);

  const cursorOpacity = Math.floor(frame / 15) % 2 === 0 ? 1 : 0;

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight,
        color,
        ...style,
      }}
    >
      {displayText}
      <span style={{ opacity: cursorOpacity }}>|</span>
    </div>
  );
};

export const GradientText: React.FC<AnimatedTextProps & { gradient?: string }> = ({
  text,
  delay = 0,
  fontSize = 48,
  fontWeight = "700",
  gradient = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight,
        background: gradient,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        transform: `scale(${scale})`,
        opacity,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
