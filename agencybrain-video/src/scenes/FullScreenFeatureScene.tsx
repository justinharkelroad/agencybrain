import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

type FeatureData = {
  image: string;
  title: string;
  subtitle: string;
  features: string[];
  accentColor: string;
};

type LayoutVariant = "left" | "right" | "center" | "bottom";

type FullScreenFeatureSceneProps = {
  feature: FeatureData;
  layout?: LayoutVariant;
};

export const FullScreenFeatureScene: React.FC<FullScreenFeatureSceneProps> = ({
  feature,
  layout = "left",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const { image, title, subtitle, features, accentColor } = feature;

  // Image entrance - smooth zoom
  const imageEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const imageScale = interpolate(imageEntrance, [0, 1], [1.15, 1.05], {
    extrapolateRight: "clamp",
  });

  const imageOpacity = interpolate(imageEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle Ken Burns pan
  const panX = interpolate(frame, [0, 300], [0, -20], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const panY = interpolate(frame, [0, 300], [0, -10], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // === TITLE POP ANIMATION ===
  const titleDelay = 8;
  const titlePop = spring({
    frame: frame - titleDelay,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.8 },
  });

  const titleScale = interpolate(titlePop, [0, 1], [0.3, 1], {
    extrapolateRight: "clamp",
  });

  const titleOpacity = interpolate(titlePop, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // === SUBTITLE POP (slightly before title) ===
  const subtitleDelay = 5;
  const subtitlePop = spring({
    frame: frame - subtitleDelay,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const subtitleOpacity = interpolate(subtitlePop, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleY = interpolate(subtitlePop, [0, 1], [-30, 0], {
    extrapolateRight: "clamp",
  });

  // === CORNER GLOW ANIMATIONS ===
  const glowPulse1 = interpolate(Math.sin(frame * 0.04), [-1, 1], [0.2, 0.5]);
  const glowPulse2 = interpolate(Math.sin(frame * 0.05 + 1), [-1, 1], [0.15, 0.4]);
  const glowPulse3 = interpolate(Math.sin(frame * 0.03 + 2), [-1, 1], [0.1, 0.35]);
  const glowPulse4 = interpolate(Math.sin(frame * 0.045 + 3), [-1, 1], [0.15, 0.45]);

  // === LIGHT RAYS from corners ===
  const rayCount = 6;
  const rays = Array.from({ length: rayCount }).map((_, i) => {
    const rayDelay = 10 + i * 3;
    const rayProgress = spring({
      frame: frame - rayDelay,
      fps,
      config: { damping: 25, stiffness: 100 },
    });
    return { progress: rayProgress, index: i };
  });

  // Star field for consistency
  const stars = Array.from({ length: 30 }).map((_, i) => {
    const x = (i * 137.5) % 100;
    const y = (i * 89.3) % 100;
    const size = 1 + (i % 2);
    const twinkle = interpolate(
      Math.sin(frame * 0.05 + i * 0.8),
      [-1, 1],
      [0.05, 0.3]
    );
    return { x, y, size, opacity: twinkle };
  });

  // Layout-specific styles
  const getLayoutStyles = () => {
    switch (layout) {
      case "right":
        return {
          textPosition: {
            right: 80,
            left: "auto",
            top: 0,
            bottom: 0,
            width: "50%",
            justifyContent: "center" as const,
          },
          textAlign: "right" as const,
          gradientDirection: "270deg",
          gradientPosition: "right",
          titleSlideFrom: 80,
          featureJustify: "flex-end" as const,
          rayCorner: "topRight" as const,
        };
      case "center":
        return {
          textPosition: {
            left: 0,
            right: 0,
            top: "50%",
            bottom: "auto",
            width: "100%",
            justifyContent: "center" as const,
            transform: "translateY(-50%)",
          },
          textAlign: "center" as const,
          gradientDirection: "0deg",
          gradientPosition: "center",
          titleSlideFrom: 0,
          featureJustify: "center" as const,
          rayCorner: "all" as const,
        };
      case "bottom":
        return {
          textPosition: {
            left: 80,
            right: 80,
            top: "auto",
            bottom: 80,
            width: "auto",
            justifyContent: "flex-end" as const,
          },
          textAlign: "left" as const,
          gradientDirection: "0deg",
          gradientPosition: "bottom",
          titleSlideFrom: 60,
          featureJustify: "flex-start" as const,
          rayCorner: "bottomLeft" as const,
        };
      case "left":
      default:
        return {
          textPosition: {
            left: 80,
            right: "auto",
            top: 0,
            bottom: 0,
            width: "50%",
            justifyContent: "center" as const,
          },
          textAlign: "left" as const,
          gradientDirection: "90deg",
          gradientPosition: "left",
          titleSlideFrom: -80,
          featureJustify: "flex-start" as const,
          rayCorner: "topLeft" as const,
        };
    }
  };

  const layoutStyles = getLayoutStyles();

  // Title slide animation
  const titleX = layout === "left" || layout === "right"
    ? interpolate(titlePop, [0, 1], [layoutStyles.titleSlideFrom, 0], { extrapolateRight: "clamp" })
    : 0;

  const titleY = layout === "center" || layout === "bottom"
    ? interpolate(titlePop, [0, 1], [40, 0], { extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a0a14 0%, #0d0d1a 50%, #0a0a14 100%)" }}>
      {/* Star field */}
      {stars.map((star, i) => (
        <div
          key={`star-${i}`}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: star.opacity,
            zIndex: 0,
          }}
        />
      ))}

      {/* Full screen image */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: imageOpacity,
          transform: `scale(${imageScale}) translate(${panX}px, ${panY}px)`,
          transformOrigin: "center center",
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile(image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
      </div>

      {/* === CORNER GLOWS === */}
      {/* Top-left glow */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 500,
          height: 500,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${glowPulse1 * 0.5}) 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      {/* Top-right glow */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 500,
          height: 500,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${glowPulse2 * 0.5}) 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      {/* Bottom-left glow */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -100,
          width: 500,
          height: 500,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${glowPulse3 * 0.5}) 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      {/* Bottom-right glow */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          right: -100,
          width: 500,
          height: 500,
          background: `radial-gradient(ellipse, rgba(59, 130, 246, ${glowPulse4 * 0.5}) 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* === LIGHT RAYS === */}
      {rays.map((ray, i) => {
        const angle = layout === "left" ? 25 + i * 8 :
                     layout === "right" ? 155 - i * 8 :
                     layout === "bottom" ? 280 + i * 15 :
                     i * 60; // center - spread around
        const rayLength = interpolate(ray.progress, [0, 1], [0, 350], { extrapolateRight: "clamp" });
        const rayOpacity = interpolate(ray.progress, [0, 0.5, 1], [0, 0.4, 0.2], { extrapolateRight: "clamp" });

        const rayOrigin = layout === "left" ? { left: 0, top: "30%" } :
                         layout === "right" ? { right: 0, top: "30%" } :
                         layout === "bottom" ? { left: "20%", bottom: 0 } :
                         { left: "50%", top: "50%" };

        return (
          <div
            key={`ray-${i}`}
            style={{
              position: "absolute",
              ...rayOrigin,
              width: 3,
              height: rayLength,
              background: `linear-gradient(to top, rgba(59, 130, 246, ${rayOpacity}) 0%, transparent 100%)`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "center bottom",
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        );
      })}

      {/* Gradient overlay based on layout */}
      {(layout === "left" || layout === "right") && (
        <div
          style={{
            position: "absolute",
            top: 0,
            [layoutStyles.gradientPosition]: 0,
            width: "55%",
            height: "100%",
            background: `linear-gradient(${layoutStyles.gradientDirection}, rgba(10, 10, 20, 0.95) 0%, rgba(10, 10, 20, 0.8) 40%, rgba(10, 10, 20, 0.4) 70%, transparent 100%)`,
            zIndex: 3,
          }}
        />
      )}

      {layout === "center" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at center, rgba(10, 10, 20, 0.75) 0%, rgba(10, 10, 20, 0.5) 50%, rgba(10, 10, 20, 0.3) 100%)",
            zIndex: 3,
          }}
        />
      )}

      {layout === "bottom" && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "55%",
            background: "linear-gradient(0deg, rgba(10, 10, 20, 0.95) 0%, rgba(10, 10, 20, 0.7) 50%, transparent 100%)",
            zIndex: 3,
          }}
        />
      )}

      {/* Text panel */}
      <div
        style={{
          position: "absolute",
          ...layoutStyles.textPosition,
          display: "flex",
          flexDirection: "column",
          padding: layout === "center" ? "0 120px" : layout === "bottom" ? "0" : "0 60px",
          zIndex: 10,
        }}
      >
        {/* Subtitle - pops in first */}
        <div
          style={{
            fontFamily,
            fontSize: 30,
            fontWeight: 700,
            color: "#3b82f6",
            textTransform: "uppercase",
            letterSpacing: 8,
            marginBottom: 20,
            textAlign: layoutStyles.textAlign,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            textShadow: "0 0 40px rgba(59, 130, 246, 0.6)",
          }}
        >
          {subtitle}
        </div>

        {/* Title - BIG and pops in */}
        <div
          style={{
            fontFamily,
            fontSize: layout === "center" ? 110 : 100,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.0,
            marginBottom: 40,
            textAlign: layoutStyles.textAlign,
            textShadow: "0 4px 40px rgba(0,0,0,0.9), 0 0 80px rgba(59, 130, 246, 0.4)",
            opacity: titleOpacity,
            transform: `scale(${titleScale}) translate(${titleX}px, ${titleY}px)`,
            transformOrigin: layoutStyles.textAlign === "right" ? "right center" :
                            layoutStyles.textAlign === "center" ? "center center" : "left center",
          }}
        >
          {title}
        </div>

        {/* Features list */}
        <div
          style={{
            display: "flex",
            flexDirection: layout === "center" ? "row" : "column",
            gap: layout === "center" ? 40 : 16,
            flexWrap: "wrap",
            justifyContent: layoutStyles.featureJustify,
          }}
        >
          {features.map((feat, i) => {
            const featDelay = 25 + i * 6;
            const featEntrance = spring({
              frame: frame - featDelay,
              fps,
              config: { damping: 12, stiffness: 150 },
            });

            const featOpacity = interpolate(featEntrance, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            });

            const featScale = interpolate(featEntrance, [0, 1], [0.8, 1], {
              extrapolateRight: "clamp",
            });

            const featX = layout === "left" ? interpolate(featEntrance, [0, 1], [-40, 0], { extrapolateRight: "clamp" }) :
                         layout === "right" ? interpolate(featEntrance, [0, 1], [40, 0], { extrapolateRight: "clamp" }) : 0;
            const featY = (layout === "center" || layout === "bottom") ? interpolate(featEntrance, [0, 1], [25, 0], { extrapolateRight: "clamp" }) : 0;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: featOpacity,
                  transform: `scale(${featScale}) translate(${featX}px, ${featY}px)`,
                  flexDirection: layout === "right" ? "row-reverse" : "row",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    boxShadow: "0 0 20px #3b82f6, 0 0 40px rgba(59, 130, 246, 0.6)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily,
                    fontSize: 32,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.95)",
                    textAlign: layoutStyles.textAlign,
                    textShadow: "0 2px 15px rgba(0,0,0,0.6)",
                  }}
                >
                  {feat}
                </span>
              </div>
            );
          })}
        </div>

        {/* Accent line - animated */}
        <div
          style={{
            marginTop: 35,
            height: 4,
            background: `linear-gradient(${layout === "right" ? "270deg" : "90deg"}, #3b82f6, #6366f1, transparent)`,
            width: interpolate(
              spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 100 } }),
              [0, 1],
              [0, 250],
              { extrapolateRight: "clamp" }
            ),
            alignSelf: layout === "right" ? "flex-end" : layout === "center" ? "center" : "flex-start",
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Vignette */}
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

// Pre-configured feature data
export const dashboardFeature1: FeatureData = {
  image: "Dashboard1.png",
  title: "Sales Tracking",
  subtitle: "Real-Time Metrics",
  accentColor: "#3b82f6",
  features: [
    "Watch rings fill as sales load in real-time",
    "KPIs update automatically",
    "See what's going well and what needs attention",
  ],
};

export const dashboardFeature2: FeatureData = {
  image: "Dashboard2.png",
  title: "Core Four",
  subtitle: "Body • Being • Balance • Business",
  accentColor: "#3b82f6",
  features: [
    "Track all four pillars of success",
    "Click buttons for reactive results",
    "Build personal targets and habits",
  ],
};

export const dashboardFeature3: FeatureData = {
  image: "Dashboard4.png",
  title: "Performance Metrics",
  subtitle: "Trend Analysis",
  accentColor: "#3b82f6",
  features: [
    "Input data and track month over month",
    "Ready for any coaching call",
    "Historical trends at your fingertips",
  ],
};

export const dashboardFeature4: FeatureData = {
  image: "Dashboard5.png",
  title: "Focused Targets",
  subtitle: "Weekly Goals",
  accentColor: "#3b82f6",
  features: [
    "Keep yourself on track every week",
    "Due dates for accountability",
    "Visual progress tracking",
  ],
};

export const dashboardFeature5: FeatureData = {
  image: "Dashboard6.png",
  title: "Renewals & AI",
  subtitle: "Automated Intelligence",
  accentColor: "#3b82f6",
  features: [
    "See renewals coming up in your book",
    "AI roleplay sessions auto-fed to dashboard",
    "Review staff performance instantly",
  ],
};

export const metricsFeature1: FeatureData = {
  image: "Metrics1.png",
  title: "Activity Rings",
  subtitle: "Team Performance",
  accentColor: "#3b82f6",
  features: [
    "Customizable activity metrics",
    "See who achieved what",
    "Daily targets that motivate",
  ],
};

export const metricsFeature2: FeatureData = {
  image: "Metrics2.png",
  title: "Sky's Eye View",
  subtitle: "Team Overview",
  accentColor: "#3b82f6",
  features: [
    "All team rings at a glance",
    "Feed back directly to your staff",
    "What matters most, visualized",
  ],
};

export const callScoringFeature1: FeatureData = {
  image: "Callscoring1.png",
  title: "Instant AI Feedback",
  subtitle: "Call Analysis",
  accentColor: "#3b82f6",
  features: [
    "Analysis within seconds of upload",
    "No more 45-minute call reviews",
    "Focus on what matters",
  ],
};

export const callScoringFeature2: FeatureData = {
  image: "Callscoring2.png",
  title: "Deep Insights",
  subtitle: "Customizable Scoring",
  accentColor: "#3b82f6",
  features: [
    "Completely customizable per agency",
    "Focus on your specific needs",
    "Detailed breakdown reports",
  ],
};

export const callScoringFeature3: FeatureData = {
  image: "Callscoring3.png",
  title: "Statement Extraction",
  subtitle: "Key Moments",
  accentColor: "#3b82f6",
  features: [
    "Pull key statements automatically",
    "Focus on deal-closing moments",
    "Train from the best examples",
  ],
};

export const lqsFeature1: FeatureData = {
  image: "LQS1.png",
  title: "Visual Pipeline",
  subtitle: "Lead Qualification",
  accentColor: "#3b82f6",
  features: [
    "Open leads → Quoted → Sold",
    "Watch leads migrate through stages",
    "Never lose a prospect again",
  ],
};

export const lqsFeature2: FeatureData = {
  image: "LQS2.png",
  title: "ROI Analytics",
  subtitle: "Smart Decisions",
  accentColor: "#3b82f6",
  features: [
    "Auto-calculated from your uploads",
    "ROI by lead source",
    "Make smarter buying decisions",
  ],
};

export const cancelAuditFeature1: FeatureData = {
  image: "Cancel Audit.png",
  title: "Save More Policies",
  subtitle: "Cancel Audit",
  accentColor: "#3b82f6",
  features: [
    "Track and gamify retention",
    "Reward your team for saves",
    "Prevent policy lapses",
  ],
};

export const cancelAuditFeature2: FeatureData = {
  image: "Cancel Audit2.png",
  title: "Urgency Timeline",
  subtitle: "Time-Sensitive Actions",
  accentColor: "#3b82f6",
  features: [
    "Auto-adjusting timeline",
    "Attack by bucket and days",
    "Save policies before it's too late",
  ],
};

export const trainingFeature1: FeatureData = {
  image: "Standard Training1.png",
  title: "Playbook Training",
  subtitle: "Standard Modules",
  accentColor: "#3b82f6",
  features: [
    "Standard Playbook modules included",
    "Download documents",
    "Quizzes to verify understanding",
  ],
};

export const trainingFeature2: FeatureData = {
  image: "Standard Training2.png",
  title: "Structured Lessons",
  subtitle: "Organized Learning",
  accentColor: "#3b82f6",
  features: [
    "Progress through at your pace",
    "Track completion status",
    "Everything your team needs",
  ],
};

export const trainingFeature3: FeatureData = {
  image: "Standard Training3.png",
  title: "Rich Content",
  subtitle: "Multimedia Training",
  accentColor: "#3b82f6",
  features: [
    "Videos, images, and documents",
    "All in one place",
    "Comprehensive learning experience",
  ],
};

export const agencyTrainingFeature1: FeatureData = {
  image: "AgencyTraining1.png",
  title: "Build Your Own",
  subtitle: "Custom Training",
  accentColor: "#3b82f6",
  features: [
    "Create by category, module, lesson",
    "Add your own videos",
    "Assign to staff members",
  ],
};

export const agencyTrainingFeature2: FeatureData = {
  image: "AgencyTraining2.png",
  title: "Track Progress",
  subtitle: "Staff Development",
  accentColor: "#3b82f6",
  features: [
    "Watch completion in real-time",
    "Ensure everyone's aligned",
    "Accountability built-in",
  ],
};

export const compFeature1: FeatureData = {
  image: "Comp1.png",
  title: "Statement Analyzer",
  subtitle: "Compensation Tools",
  accentColor: "#3b82f6",
  features: [
    "Upload and verify payments",
    "Year over year trends",
    "Never miss incorrect pay",
  ],
};

export const compFeature2: FeatureData = {
  image: "UseAitoBuildCommissionPlans.png",
  title: "AI Commission Builder",
  subtitle: "Smart Planning",
  accentColor: "#3b82f6",
  features: [
    "Let AI help build plans",
    "Upload docs for analysis",
    "Dial it in perfectly",
  ],
};

export const compFeature3: FeatureData = {
  image: "Run Comp within seconds.png",
  title: "Run Comp Instantly",
  subtitle: "No Spreadsheets",
  accentColor: "#3b82f6",
  features: [
    "Commission statements in seconds",
    "No more spreadsheet headaches",
    "Accurate every time",
  ],
};

export const bonusFeature1: FeatureData = {
  image: "AnnualBonustool1.png",
  title: "Easiest Bonus Tracking",
  subtitle: "Annual Bonus Tool",
  accentColor: "#3b82f6",
  features: [
    "Simply drop two files",
    "Instant calculations",
    "Easiest tracker you've seen",
  ],
};

export const bonusFeature2: FeatureData = {
  image: "AnnualBonustool2.png",
  title: "Immediate Feedback",
  subtitle: "Target Visibility",
  accentColor: "#3b82f6",
  features: [
    "See exactly what you need",
    "Hit your targets",
    "No guesswork required",
  ],
};

export const flowsFeature1: FeatureData = {
  image: "Flows1.png",
  title: "Process Emotions",
  subtitle: "Flow States",
  accentColor: "#3b82f6",
  features: [
    "Work through triggers",
    "Agency, body, being, or business",
    "Get to revelation",
  ],
};

export const flowsFeature2: FeatureData = {
  image: "Flows2airesponse.png",
  title: "AI Coaching",
  subtitle: "Personalized Guidance",
  accentColor: "#3b82f6",
  features: [
    "Tell AI who you are",
    "Get personalized guidance",
    "Hit your targets",
  ],
};

export const targetFeature1: FeatureData = {
  image: "Core4.png",
  title: "Core Four System",
  subtitle: "Stay Centered",
  accentColor: "#3b82f6",
  features: [
    "Body, being, balance, business",
    "Click to track progress",
    "Holistic success tracking",
  ],
};

export const targetFeature2: FeatureData = {
  image: "Monthly Mission1.png",
  title: "Monthly Missions",
  subtitle: "Accountability",
  accentColor: "#3b82f6",
  features: [
    "Set missions for yourself and staff",
    "Hold each other accountable",
    "Grow together as a team",
  ],
};

export const targetFeature3: FeatureData = {
  image: "Quarterly Targets.png",
  title: "Quarterly Targets",
  subtitle: "AI-Assisted Goals",
  accentColor: "#3b82f6",
  features: [
    "AI creates quarterly targets",
    "Monthly missions auto-generated",
    "Daily actions to take",
  ],
};

export const otherFeature1: FeatureData = {
  image: "WinbackHQ.png",
  title: "Winback HQ",
  subtitle: "Customer Recovery",
  accentColor: "#3b82f6",
  features: [
    "Churned customers into campaigns",
    "Customizable timing",
    "Based on renewal dates",
  ],
};

export const otherFeature2: FeatureData = {
  image: "Ternination Tracking.png",
  title: "Termination Tracking",
  subtitle: "Retention Insights",
  accentColor: "#3b82f6",
  features: [
    "Upload termination audits",
    "See reasons at a glance",
    "Improve retention rates",
  ],
};

export const otherFeature3: FeatureData = {
  image: "Sidebar.png",
  title: "Customer Sidebar",
  subtitle: "Full Context",
  accentColor: "#3b82f6",
  features: [
    "Click any prospect or customer",
    "See their full journey",
    "Never lose context",
  ],
};

export const otherFeature4: FeatureData = {
  image: "Share Exchange.png",
  title: "Share Exchange",
  subtitle: "Community Growth",
  accentColor: "#3b82f6",
  features: [
    "Social-style platform",
    "Share processes and tips",
    "Grow together as a community",
  ],
};
