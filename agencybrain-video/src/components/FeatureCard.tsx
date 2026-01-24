import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  delay?: number;
  accentColor?: string;
};

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay = 0,
  accentColor = "#6366f1",
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

  const translateY = interpolate(entrance, [0, 1], [60, 0], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(entrance, [0, 1], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        borderRadius: 20,
        padding: 32,
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        minWidth: 300,
        maxWidth: 350,
      }}
    >
      <div
        style={{
          fontSize: 48,
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 26,
          fontWeight: 600,
          color: "#ffffff",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 16,
          fontWeight: 400,
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
          borderRadius: "20px 20px 0 0",
        }}
      />
    </div>
  );
};

export const IconFeature: React.FC<{
  icon: string;
  label: string;
  delay?: number;
}> = ({ icon, label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(entrance, [0, 1], [0.5, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: 64,
          filter: "drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 18,
          fontWeight: 600,
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
};
