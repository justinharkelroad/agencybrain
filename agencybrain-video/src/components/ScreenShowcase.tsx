import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

type ScreenShowcaseProps = {
  imagePath: string;
  title: string;
  subtitle?: string;
  features?: string[];
  delay?: number;
  position?: "center" | "left" | "right";
  showBrowser?: boolean;
  scale?: number;
};

export const ScreenShowcase: React.FC<ScreenShowcaseProps> = ({
  imagePath,
  title,
  subtitle,
  features = [],
  delay = 0,
  position = "center",
  showBrowser = true,
  scale = 0.65,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Main entrance animation
  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(entrance, [0, 1], [100, 0], {
    extrapolateRight: "clamp",
  });

  const scaleValue = interpolate(entrance, [0, 1], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle floating animation
  const float = Math.sin((frame - delay) * 0.03) * 5;

  // Position calculations
  const positionStyles: Record<string, React.CSSProperties> = {
    center: {
      left: "50%",
      transform: `translateX(-50%) translateY(${translateY + float}px) scale(${scaleValue})`,
    },
    left: {
      left: 60,
      transform: `translateY(${translateY + float}px) scale(${scaleValue})`,
    },
    right: {
      right: 60,
      transform: `translateY(${translateY + float}px) scale(${scaleValue})`,
    },
  };

  // Text position based on screen position
  const textPosition =
    position === "left"
      ? { right: 80, left: "auto", textAlign: "right" as const }
      : position === "right"
        ? { left: 80, right: "auto", textAlign: "left" as const }
        : { left: "50%", transform: "translateX(-50%)", textAlign: "center" as const };

  return (
    <>
      {/* Title and subtitle */}
      <div
        style={{
          position: "absolute",
          top: 60,
          width: position === "center" ? "100%" : "40%",
          ...textPosition,
          opacity: interpolate(
            spring({ frame: frame - delay - 5, fps, config: { damping: 200 } }),
            [0, 1],
            [0, 1]
          ),
          zIndex: 10,
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
          {subtitle || "Feature Highlight"}
        </div>
        <div
          style={{
            fontFamily,
            fontSize: position === "center" ? 52 : 44,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>

        {/* Feature bullets */}
        {features.length > 0 && (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {features.map((feature, i) => {
              const featureEntrance = spring({
                frame: frame - delay - 20 - i * 8,
                fps,
                config: { damping: 200 },
              });
              const featureOpacity = interpolate(featureEntrance, [0, 1], [0, 1], {
                extrapolateRight: "clamp",
              });
              const featureX = interpolate(featureEntrance, [0, 1], [position === "right" ? -30 : 30, 0], {
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    fontFamily,
                    fontSize: 18,
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.8)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    opacity: featureOpacity,
                    transform: `translateX(${featureX}px)`,
                    justifyContent: position === "left" ? "flex-end" : "flex-start",
                  }}
                >
                  <span style={{ color: "#6366f1", fontSize: 20 }}>✓</span>
                  {feature}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Browser mockup with screenshot */}
      <div
        style={{
          position: "absolute",
          top: position === "center" ? 180 : 200,
          opacity,
          ...positionStyles[position],
        }}
      >
        {showBrowser ? (
          <BrowserMockup scale={scale}>
            <Img
              src={staticFile(imagePath)}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </BrowserMockup>
        ) : (
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(99, 102, 241, 0.2)",
              transform: `scale(${scale})`,
              transformOrigin: position === "center" ? "center top" : position === "left" ? "left top" : "right top",
            }}
          >
            <Img
              src={staticFile(imagePath)}
              style={{
                width: "auto",
                maxWidth: 1600,
                height: "auto",
                display: "block",
              }}
            />
          </div>
        )}
      </div>
    </>
  );
};

// Browser mockup wrapper
const BrowserMockup: React.FC<{
  children: React.ReactNode;
  scale?: number;
}> = ({ children, scale = 0.65 }) => {
  const frame = useCurrentFrame();

  // Glowing border effect
  const glowIntensity = interpolate(Math.sin(frame * 0.05), [-1, 1], [15, 30]);

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "linear-gradient(145deg, #1a1a2e, #0f0f1a)",
        boxShadow: `
          0 25px 80px rgba(0,0,0,0.5),
          0 0 ${glowIntensity}px rgba(99, 102, 241, 0.3),
          inset 0 1px 0 rgba(255,255,255,0.1)
        `,
        border: "1px solid rgba(99, 102, 241, 0.2)",
        transform: `scale(${scale})`,
        transformOrigin: "center top",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 40,
          background: "linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
        <div
          style={{
            marginLeft: 16,
            flex: 1,
            marginRight: 80,
            height: 24,
            borderRadius: 6,
            background: "rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
          }}
        >
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            app.agencybrain.io
          </span>
        </div>
      </div>

      {/* Screenshot content */}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
};

// Animated click indicator
export const ClickIndicator: React.FC<{
  x: number;
  y: number;
  delay?: number;
}> = ({ x, y, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const rippleScale = interpolate(
    frame - delay,
    [0, 30],
    [1, 2.5],
    { extrapolateRight: "clamp" }
  );

  const rippleOpacity = interpolate(
    frame - delay,
    [0, 30],
    [0.6, 0],
    { extrapolateRight: "clamp" }
  );

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Ripple effect */}
      <div
        style={{
          position: "absolute",
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "2px solid #6366f1",
          transform: `translate(-50%, -50%) scale(${rippleScale})`,
          opacity: rippleOpacity,
          left: "50%",
          top: "50%",
        }}
      />
      {/* Cursor dot */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          boxShadow: "0 0 20px rgba(99, 102, 241, 0.6)",
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
};

// Animated highlight box
export const HighlightBox: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  delay?: number;
  color?: string;
}> = ({ x, y, width, height, delay = 0, color = "#6366f1" }) => {
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

  const pulseOpacity = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.6]);

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 8,
        border: `2px solid ${color}`,
        background: `${color}15`,
        opacity: opacity * pulseOpacity,
        boxShadow: `0 0 20px ${color}40`,
      }}
    />
  );
};

// Feature text overlay
export const FeatureCallout: React.FC<{
  text: string;
  x: number;
  y: number;
  delay?: number;
  direction?: "left" | "right";
}> = ({ text, x, y, delay = 0, direction = "right" }) => {
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

  const translateX = interpolate(entrance, [0, 1], [direction === "right" ? -20 : 20, 0], {
    extrapolateRight: "clamp",
  });

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: direction === "right" ? x : "auto",
        right: direction === "left" ? x : "auto",
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity,
        transform: `translateX(${translateX}px)`,
        flexDirection: direction === "left" ? "row-reverse" : "row",
      }}
    >
      {/* Connecting line */}
      <div
        style={{
          width: 40,
          height: 2,
          background: "linear-gradient(90deg, #6366f1, transparent)",
          transform: direction === "left" ? "scaleX(-1)" : "none",
        }}
      />
      {/* Callout box */}
      <div
        style={{
          fontFamily,
          fontSize: 16,
          fontWeight: 600,
          color: "#ffffff",
          background: "rgba(99, 102, 241, 0.2)",
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px solid rgba(99, 102, 241, 0.3)",
          backdropFilter: "blur(10px)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};
