import { AbsoluteFill, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";

import { IntroScene } from "./scenes/IntroScene";
import { ClosingCTAScene } from "./scenes/ClosingCTAScene";
import {
  FullScreenFeatureScene,
  dashboardFeature1,
  dashboardFeature2,
  dashboardFeature3,
  dashboardFeature5,
  metricsFeature1,
  metricsFeature2,
  callScoringFeature1,
  callScoringFeature2,
  lqsFeature1,
  lqsFeature2,
  cancelAuditFeature1,
  trainingFeature1,
  trainingFeature2,
  agencyTrainingFeature1,
  compFeature1,
  compFeature2,
  bonusFeature1,
  flowsFeature1,
  flowsFeature2,
  targetFeature2,
  targetFeature3,
  otherFeature1,
  otherFeature3,
  otherFeature4,
} from "./scenes/FullScreenFeatureScene";

export const AgencyBrainPromo: React.FC = () => {
  const { fps } = useVideoConfig();

  // SLOWER pacing - 4 seconds per feature so text is readable
  const introDuration = Math.round(4.5 * fps); // 4.5 seconds
  const featureDuration = Math.round(4 * fps); // 4 seconds per feature
  const closingDuration = Math.round(5 * fps); // 5 seconds

  // Smooth transitions
  const transitionDuration = Math.round(0.6 * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <TransitionSeries>
        {/* INTRO SCENE */}
        <TransitionSeries.Sequence durationInFrames={introDuration}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* DASHBOARD 1 - Sales Tracking - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={dashboardFeature1} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* DASHBOARD 2 - Core Four - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={dashboardFeature2} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* DASHBOARD 3 - Performance - CENTER layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={dashboardFeature3} layout="center" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* METRICS 1 - Activity Rings - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={metricsFeature1} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* METRICS 2 - Sky's Eye View - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={metricsFeature2} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* CALL SCORING 1 - BOTTOM layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={callScoringFeature1} layout="bottom" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={flip({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* CALL SCORING 2 - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={callScoringFeature2} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* LQS 1 - Pipeline - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={lqsFeature1} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* LQS 2 - ROI - CENTER layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={lqsFeature2} layout="center" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* CANCEL AUDIT - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={cancelAuditFeature1} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={flip({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* TRAINING 1 - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={trainingFeature1} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* TRAINING 2 - BOTTOM layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={trainingFeature2} layout="bottom" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-top-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* AGENCY TRAINING - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={agencyTrainingFeature1} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* COMP 1 - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={compFeature1} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* COMP 2 - CENTER layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={compFeature2} layout="center" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* BONUS - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={bonusFeature1} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-top-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* FLOWS 1 - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={flowsFeature1} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* FLOWS 2 - BOTTOM layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={flowsFeature2} layout="bottom" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* RENEWALS & AI - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={dashboardFeature5} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* MONTHLY MISSIONS - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={targetFeature2} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={flip({ direction: "from-top" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* QUARTERLY TARGETS - CENTER layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={targetFeature3} layout="center" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-top" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* WINBACK - CENTER layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={otherFeature1} layout="center" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* SIDEBAR - LEFT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={otherFeature3} layout="left" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={flip({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* SHARE EXCHANGE - RIGHT layout */}
        <TransitionSeries.Sequence durationInFrames={featureDuration}>
          <FullScreenFeatureScene feature={otherFeature4} layout="right" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: transitionDuration })}
        />

        {/* CLOSING CTA */}
        <TransitionSeries.Sequence durationInFrames={closingDuration}>
          <ClosingCTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
