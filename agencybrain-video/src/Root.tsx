import { Composition } from "remotion";
import { AgencyBrainPromo } from "./AgencyBrainPromo";

export const RemotionRoot: React.FC = () => {
  const fps = 30;

  // Video duration calculation:
  // Intro: 4.5s + 23 features × 4s + Closing: 5s - transitions overlap
  // Total approximately 100 seconds
  const durationInSeconds = 105;
  const durationInFrames = durationInSeconds * fps;

  return (
    <Composition
      id="AgencyBrainPromo"
      component={AgencyBrainPromo}
      durationInFrames={durationInFrames}
      fps={fps}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
