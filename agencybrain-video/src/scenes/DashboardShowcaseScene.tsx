import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
  Sequence,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// Dashboard images with their descriptions
const dashboardFeatures = [
  {
    image: "Dashboard1.png",
    title: "Sales Tracking",
    description: "Watch rings fill as sales load in real-time",
  },
  {
    image: "Dashboard2.png",
    title: "Core Four & Balance",
    description: "Track body, being, balance & business",
  },
  {
    image: "Dashboard3.png",
    title: "Core Four Detail",
    description: "Deep dive into what matters most",
  },
  {
    image: "Dashboard4.png",
    title: "Performance Metrics",
    description: "Month over month trend analysis",
  },
  {
    image: "Dashboard5.png",
    title: "Focused Targets",
    description: "Weekly goals with due dates",
  },
  {
    image: "Dashboard6.png",
    title: "Renewals & AI Sessions",
    description: "Book of business + AI roleplay reviews",
  },
  {
    image: "Dashboard7.png",
    title: "Activity Metrics",
    description: "Team customizable activity rings",
  },
];

export const DashboardShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Calculate which dashboard to show (cycle through them)
  const totalDuration = 210; // frames for this scene
  const imagesPerCycle = dashboardFeatures.length;
  const framesPerImage = Math.floor(totalDuration / 3); // Show 3 images in the scene

  // Determine which 3 images to show based on scene timing
  const currentIndex = Math.floor(frame / framesPerImage) % imagesPerCycle;
  const localFrame = frame % framesPerImage;

  // Title entrance
  const titleEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%)",
      }}
    >
      <GridBackground opacity={0.04} />
      <GradientOrb x={100} y={100} size={400} color1="#6366f1" color2="#0a0a0f" delay={0} />
      <GradientOrb x={1600} y={600} size={350} color1="#8b5cf6" color2="#0a0a0f" delay={20} />

      {/* Section header */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 80,
          opacity: interpolate(titleEntrance, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleEntrance, [0, 1], [-30, 0])}px)`,
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
          Command Center
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 56,
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          Your Dashboard
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 20,
            fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
            marginTop: 8,
          }}
        >
          Everything you need at a glance
        </div>
      </div>

      {/* Carousel of dashboard images */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          bottom: 40,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          perspective: 1500,
        }}
      >
        {/* Show current and next images with smooth transition */}
        {[0, 1, 2].map((offset) => {
          const imageIndex = (currentIndex + offset) % imagesPerCycle;
          const feature = dashboardFeatures[imageIndex];

          const imageFrame = localFrame - offset * (framesPerImage / 3);
          const entrance = spring({
            frame: imageFrame,
            fps,
            config: { damping: 200 },
          });

          const scale = interpolate(
            offset,
            [0, 1, 2],
            [0.55, 0.45, 0.38]
          );

          const translateX = interpolate(
            offset,
            [0, 1, 2],
            [0, 480, 900]
          );

          const zIndex = 10 - offset;
          const opacity = interpolate(offset, [0, 1, 2], [1, 0.7, 0.4]);

          const entranceOpacity = interpolate(entrance, [0, 1], [0, opacity], {
            extrapolateRight: "clamp",
          });

          const entranceY = interpolate(entrance, [0, 1], [80, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={`${imageIndex}-${offset}`}
              style={{
                position: "absolute",
                left: "50%",
                transform: `translateX(calc(-50% + ${translateX}px)) translateY(${entranceY}px) scale(${scale})`,
                opacity: entranceOpacity,
                zIndex,
                transformOrigin: "center top",
              }}
            >
              {/* Browser mockup */}
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "linear-gradient(145deg, #1a1a2e, #0f0f1a)",
                  boxShadow: `
                    0 25px 80px rgba(0,0,0,0.5),
                    0 0 30px rgba(99, 102, 241, ${0.3 - offset * 0.1}),
                    inset 0 1px 0 rgba(255,255,255,0.1)
                  `,
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                {/* Browser chrome */}
                <div
                  style={{
                    height: 36,
                    background: "linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%)",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 14,
                    gap: 7,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
                </div>

                <Img
                  src={staticFile(feature.image)}
                  style={{
                    width: 1400,
                    height: "auto",
                    display: "block",
                  }}
                />
              </div>

              {/* Feature label */}
              {offset === 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -60,
                    left: "50%",
                    transform: "translateX(-50%)",
                    textAlign: "center",
                    opacity: interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div
                    style={{
                      fontFamily,
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#ffffff",
                    }}
                  >
                    {feature.title}
                  </div>
                  <div
                    style={{
                      fontFamily,
                      fontSize: 16,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.6)",
                      marginTop: 4,
                    }}
                  >
                    {feature.description}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress indicators */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
        }}
      >
        {dashboardFeatures.slice(0, 7).map((_, i) => {
          const isActive = i === currentIndex % 7;
          return (
            <div
              key={i}
              style={{
                width: isActive ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: isActive
                  ? "linear-gradient(90deg, #6366f1, #8b5cf6)"
                  : "rgba(255,255,255,0.2)",
                transition: "width 0.3s",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
