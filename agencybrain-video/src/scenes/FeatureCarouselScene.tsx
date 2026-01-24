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
import { GradientOrb, GridBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

type FeatureGroup = {
  sectionTitle: string;
  sectionSubtitle: string;
  features: {
    image: string;
    title: string;
    description: string;
  }[];
  accentColor: string;
};

type FeatureCarouselSceneProps = {
  featureGroup: FeatureGroup;
};

export const FeatureCarouselScene: React.FC<FeatureCarouselSceneProps> = ({
  featureGroup,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { sectionTitle, sectionSubtitle, features, accentColor } = featureGroup;

  // Calculate which feature to display
  const framesPerFeature = Math.floor(180 / features.length);
  const currentIndex = Math.min(
    Math.floor(frame / framesPerFeature),
    features.length - 1
  );
  const localFrame = frame - currentIndex * framesPerFeature;

  const currentFeature = features[currentIndex];

  // Title entrance
  const titleEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  // Image entrance (resets for each image)
  const imageEntrance = spring({
    frame: localFrame,
    fps,
    config: { damping: 200 },
  });

  const imageOpacity = interpolate(imageEntrance, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = interpolate(imageEntrance, [0, 1], [0.95, 1], {
    extrapolateRight: "clamp",
  });

  const imageY = interpolate(imageEntrance, [0, 1], [60, 0], {
    extrapolateRight: "clamp",
  });

  // Floating animation
  const float = Math.sin(frame * 0.03) * 4;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%)",
      }}
    >
      <GridBackground opacity={0.04} />
      <GradientOrb x={1500} y={150} size={400} color1={accentColor} color2="#0a0a0f" delay={0} />
      <GradientOrb x={100} y={600} size={300} color1={accentColor} color2="#0a0a0f" delay={30} />

      {/* Section header - left side */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 80,
          width: 400,
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
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 12,
          }}
        >
          {sectionSubtitle}
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 48,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {sectionTitle}
        </div>

        {/* Feature description */}
        <div
          style={{
            marginTop: 40,
            opacity: imageOpacity,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 28,
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            {currentFeature.title}
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 18,
              fontWeight: 400,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
            }}
          >
            {currentFeature.description}
          </div>
        </div>

        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 40,
          }}
        >
          {features.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  i === currentIndex
                    ? `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)`
                    : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Screenshot - right side */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 60,
          opacity: imageOpacity,
          transform: `translateY(${imageY + float}px) scale(${imageScale})`,
          transformOrigin: "right top",
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
              0 0 40px ${accentColor}30,
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
            border: `1px solid ${accentColor}30`,
          }}
        >
          {/* Browser chrome */}
          <div
            style={{
              height: 32,
              background: "linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%)",
              display: "flex",
              alignItems: "center",
              paddingLeft: 12,
              gap: 6,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
          </div>

          <Img
            src={staticFile(currentFeature.image)}
            style={{
              width: 950,
              height: "auto",
              display: "block",
            }}
          />
        </div>
      </div>

      {/* Accent corner */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 500,
          height: 500,
          background: `radial-gradient(circle at top right, ${accentColor}20 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Pre-configured feature groups
export const metricsFeatures: FeatureGroup = {
  sectionTitle: "Activity Metrics",
  sectionSubtitle: "Team Performance",
  accentColor: "#22d3ee",
  features: [
    {
      image: "Metrics1.png",
      title: "Customizable Activity Rings",
      description: "See who achieved what with beautiful visual tracking. Set daily targets and watch your team crush them.",
    },
    {
      image: "Metrics2.png",
      title: "Sky's Eye View",
      description: "All team activity rings at a glance. Perfect for feeding back to your staff on what matters most.",
    },
  ],
};

export const callScoringFeatures: FeatureGroup = {
  sectionTitle: "Call Scoring",
  sectionSubtitle: "AI-Powered Analysis",
  accentColor: "#f97316",
  features: [
    {
      image: "Callscoring1.png",
      title: "Instant AI Feedback",
      description: "Get detailed analysis within seconds of dropping a call recording. No more listening to 45-minute calls.",
    },
    {
      image: "Callscoring2.png",
      title: "Deep Call Insights",
      description: "Completely customizable scoring criteria per agency. Focus on what matters to you.",
    },
    {
      image: "Callscoring3.png",
      title: "Statement Extraction",
      description: "Pull out key statements from prospects and salespeople. Focus on the moments that close deals.",
    },
  ],
};

export const lqsFeatures: FeatureGroup = {
  sectionTitle: "Lead Qualification",
  sectionSubtitle: "LQS Pipeline",
  accentColor: "#10b981",
  features: [
    {
      image: "LQS1.png",
      title: "Visual Pipeline",
      description: "Watch leads migrate from open to quoted to sold. Never lose track of a prospect again.",
    },
    {
      image: "LQS2.png",
      title: "ROI Analytics",
      description: "Automatically calculated from your uploads. See ROI by lead source and make smarter buying decisions.",
    },
  ],
};

export const cancelAuditFeatures: FeatureGroup = {
  sectionTitle: "Cancel Audit",
  sectionSubtitle: "Policy Retention",
  accentColor: "#ef4444",
  features: [
    {
      image: "Cancel Audit.png",
      title: "Save More Policies",
      description: "Track and gamify retention. Reward your team for saving policies before they lapse.",
    },
    {
      image: "Cancel Audit2.png",
      title: "Urgency Timeline",
      description: "Auto-adjusting timeline shows policies about to lapse. Attack by bucket and save them in time.",
    },
  ],
};

export const trainingFeatures: FeatureGroup = {
  sectionTitle: "Training Hub",
  sectionSubtitle: "Standard Playbook",
  accentColor: "#8b5cf6",
  features: [
    {
      image: "Standard Training1.png",
      title: "Playbook Training",
      description: "Standard Playbook modules for you and your staff. Download documents and track completion.",
    },
    {
      image: "Standard Training2.png",
      title: "Structured Lessons",
      description: "Organized modules with quizzes to verify understanding. Progress through at your own pace.",
    },
    {
      image: "Standard Training3.png",
      title: "Rich Content",
      description: "Images, videos, and documents all in one place. Everything your team needs to succeed.",
    },
  ],
};

export const agencyTrainingFeatures: FeatureGroup = {
  sectionTitle: "Agency Training",
  sectionSubtitle: "Custom Content",
  accentColor: "#ec4899",
  features: [
    {
      image: "AgencyTraining1.png",
      title: "Build Your Own",
      description: "Create custom training by category, module and lesson. Add your own videos and assign to staff.",
    },
    {
      image: "AgencyTraining2.png",
      title: "Track Progress",
      description: "Watch your staff complete the trainings you assign. Ensure everyone's on the same page.",
    },
  ],
};

export const compFeatures: FeatureGroup = {
  sectionTitle: "Compensation",
  sectionSubtitle: "Commission Tools",
  accentColor: "#facc15",
  features: [
    {
      image: "Comp1.png",
      title: "Statement Analyzer",
      description: "Upload your statement and see if you were paid correctly. Year over year trends at your fingertips.",
    },
    {
      image: "UseAitoBuildCommissionPlans.png",
      title: "AI Commission Builder",
      description: "Let AI help you build commission plans. Upload docs and get analysis to dial it in perfectly.",
    },
    {
      image: "Run Comp within seconds.png",
      title: "Run Comp Instantly",
      description: "Produce commission statements in seconds. No more spreadsheet headaches.",
    },
  ],
};

export const bonusFeatures: FeatureGroup = {
  sectionTitle: "Annual Bonus",
  sectionSubtitle: "Bonus Tracking",
  accentColor: "#14b8a6",
  features: [
    {
      image: "AnnualBonustool1.png",
      title: "Easiest Bonus Tracking",
      description: "Simply drop two files and you're done. The easiest annual bonus tracker you've ever seen.",
    },
    {
      image: "AnnualBonustool2.png",
      title: "Immediate Feedback",
      description: "Instant analysis shows exactly what you need to hit your targets.",
    },
  ],
};

export const flowsFeatures: FeatureGroup = {
  sectionTitle: "Flow States",
  sectionSubtitle: "Personal Growth",
  accentColor: "#6366f1",
  features: [
    {
      image: "Flows1.png",
      title: "Process Emotions",
      description: "Work through triggers whether in agency, body, being or business. Get to revelation.",
    },
    {
      image: "Flows2airesponse.png",
      title: "AI Coaching",
      description: "Tell the AI who you are and what you're after. Get personalized guidance to hit your targets.",
    },
  ],
};

export const targetFeatures: FeatureGroup = {
  sectionTitle: "Goals & Targets",
  sectionSubtitle: "Achievement System",
  accentColor: "#f59e0b",
  features: [
    {
      image: "Core4.png",
      title: "Core Four",
      description: "Click buttons and track progress across body, being, balance and business. Stay centered.",
    },
    {
      image: "Monthly Mission1.png",
      title: "Monthly Missions",
      description: "Set missions for yourself and your staff. Hold each other accountable and grow together.",
    },
    {
      image: "Quarterly Targets.png",
      title: "Quarterly Targets",
      description: "AI-assisted goal setting creates quarterly targets, monthly missions, and daily actions.",
    },
  ],
};

export const otherFeatures: FeatureGroup = {
  sectionTitle: "More Power",
  sectionSubtitle: "Additional Tools",
  accentColor: "#06b6d4",
  features: [
    {
      image: "WinbackHQ.png",
      title: "Winback HQ",
      description: "Put churned customers into winback campaigns. Customizable timing based on renewal dates.",
    },
    {
      image: "Ternination Tracking.png",
      title: "Termination Tracking",
      description: "Upload termination audits and see reasons at a glance. Track and improve retention.",
    },
    {
      image: "Sidebar.png",
      title: "Customer Sidebar",
      description: "Click any prospect or customer to see their full journey. Never lose context.",
    },
    {
      image: "Share Exchange.png",
      title: "Share Exchange",
      description: "Social-style platform to share processes and grow together as a community.",
    },
  ],
};
