import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { GradientText, AnimatedText } from "../components/AnimatedText";
import { GradientOrb, GridBackground, ParticleBackground } from "../components/ParticleBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const AIFeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // AI brain pulsing animation
  const pulseScale = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.95, 1.05]
  );

  const glowIntensity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [30, 60]
  );

  // Typing animation for AI chat
  const typingDots = Math.floor(frame / 10) % 4;
  const dots = ".".repeat(typingDots);

  // AI feature cards data
  const aiFeatures = [
    {
      title: "AI Sales Roleplay",
      description: "Practice with realistic AI customers and get instant feedback on your pitch",
      icon: "🎭",
      delay: 20,
    },
    {
      title: "Call Scoring",
      description: "Automatic transcription and AI-powered analysis of every call",
      icon: "📊",
      delay: 35,
    },
    {
      title: "Smart Insights",
      description: "AI identifies patterns in your data to surface opportunities",
      icon: "💡",
      delay: 50,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #0f0a1a 50%, #0a0a0f 100%)",
      }}
    >
      {/* Animated background */}
      <GridBackground opacity={0.04} />
      <ParticleBackground color="#8b5cf6" particleCount={30} />
      <GradientOrb x={960} y={300} size={500} color1="#8b5cf6" color2="#0a0a0f" delay={0} />
      <GradientOrb x={400} y={700} size={300} color1="#d946ef" color2="#0a0a0f" delay={40} />
      <GradientOrb x={1500} y={600} size={350} color1="#6366f1" color2="#0a0a0f" delay={20} />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          height: "100%",
          padding: "60px 80px",
        }}
      >
        {/* Left side - AI visualization */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* AI Brain visualization */}
          <div
            style={{
              position: "relative",
              width: 300,
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer rings */}
            {[0, 1, 2].map((i) => {
              const ringEntrance = spring({
                frame,
                fps,
                delay: i * 10,
                config: { damping: 200 },
              });
              const ringScale = interpolate(ringEntrance, [0, 1], [0.5, 1]);
              const ringOpacity = interpolate(ringEntrance, [0, 1], [0, 0.3 - i * 0.08]);
              const rotation = frame * (0.3 - i * 0.1);

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 250 + i * 50,
                    height: 250 + i * 50,
                    borderRadius: "50%",
                    border: `2px solid rgba(139, 92, 246, ${ringOpacity})`,
                    transform: `scale(${ringScale}) rotate(${rotation}deg)`,
                    boxShadow: `0 0 ${20 + i * 10}px rgba(139, 92, 246, ${ringOpacity})`,
                  }}
                />
              );
            })}

            {/* Center brain icon */}
            <div
              style={{
                fontSize: 120,
                transform: `scale(${pulseScale})`,
                filter: `drop-shadow(0 0 ${glowIntensity}px rgba(139, 92, 246, 0.8))`,
              }}
            >
              🧠
            </div>

            {/* Neural network nodes */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i * 60 * Math.PI) / 180;
              const radius = 130;
              const x = Math.cos(angle + frame * 0.02) * radius;
              const y = Math.sin(angle + frame * 0.02) * radius;
              const nodeEntrance = spring({
                frame,
                fps,
                delay: 30 + i * 5,
                config: { damping: 15, stiffness: 200 },
              });
              const nodeScale = interpolate(nodeEntrance, [0, 1], [0, 1]);

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 150 + x - 8,
                    top: 150 + y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #8b5cf6, #d946ef)",
                    transform: `scale(${nodeScale})`,
                    boxShadow: "0 0 20px rgba(139, 92, 246, 0.8)",
                  }}
                />
              );
            })}
          </div>

          {/* "AI Processing" text */}
          <div
            style={{
              marginTop: 40,
              fontFamily,
              fontSize: 20,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            AI Processing{dots}
          </div>
        </div>

        {/* Right side - Features */}
        <div
          style={{
            flex: 1.2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 60,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 14,
              fontWeight: 600,
              color: "#8b5cf6",
              textTransform: "uppercase",
              letterSpacing: 3,
              marginBottom: 12,
            }}
          >
            Powered by AI
          </div>

          <GradientText
            text="Intelligence Built In"
            fontSize={52}
            fontWeight="800"
            delay={5}
            gradient="linear-gradient(135deg, #ffffff 0%, #d4b4fc 100%)"
          />

          <AnimatedText
            text="AI that actually helps your team sell more"
            delay={15}
            fontSize={22}
            fontWeight="400"
            color="rgba(255,255,255,0.6)"
            style={{ marginTop: 12, marginBottom: 40 }}
          />

          {/* Feature list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {aiFeatures.map((feature, i) => {
              const cardEntrance = spring({
                frame,
                fps,
                delay: feature.delay,
                config: { damping: 200 },
              });
              const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);
              const cardX = interpolate(cardEntrance, [0, 1], [50, 0]);

              return (
                <Sequence key={i} from={0} premountFor={30}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      padding: "20px 24px",
                      background: "linear-gradient(145deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.02) 100%)",
                      borderRadius: 16,
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                      opacity: cardOpacity,
                      transform: `translateX(${cardX}px)`,
                    }}
                  >
                    <div style={{ fontSize: 40 }}>{feature.icon}</div>
                    <div>
                      <div
                        style={{
                          fontFamily,
                          fontSize: 20,
                          fontWeight: 600,
                          color: "#ffffff",
                          marginBottom: 4,
                        }}
                      >
                        {feature.title}
                      </div>
                      <div
                        style={{
                          fontFamily,
                          fontSize: 14,
                          fontWeight: 400,
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {feature.description}
                      </div>
                    </div>
                  </div>
                </Sequence>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
