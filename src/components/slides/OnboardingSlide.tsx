import { GradientText } from '@/components/marketing/ui/GradientText';
import { CountdownTimer } from './CountdownTimer';
import { FloatingQuestions } from './FloatingQuestions';

interface OnboardingSlideProps {
  category: string;
  questions: string[];
}

export function OnboardingSlide({ category, questions }: OnboardingSlideProps) {
  return (
    <div
      className="marketing-dark relative min-h-screen w-full overflow-hidden flex flex-col"
      style={{ background: 'var(--marketing-bg)' }}
    >
      {/* Background gradient blurs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: 'var(--marketing-amber)',
            top: '-10%',
            left: '-5%',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: 'var(--marketing-cyan)',
            bottom: '-10%',
            right: '-5%',
          }}
        />
      </div>

      {/* Timer - top right */}
      <div className="absolute top-6 right-8 z-20">
        <CountdownTimer />
      </div>

      {/* Floating questions */}
      <FloatingQuestions questions={questions} />

      {/* Centered headline */}
      <div className="flex-1 flex items-center justify-center z-10">
        <div className="text-center px-4">
          <h1
            className="text-2xl md:text-4xl font-semibold tracking-widest uppercase mb-2"
            style={{ color: 'var(--marketing-text)' }}
          >
            HOW DO WE ONBOARD:
          </h1>
          <GradientText
            as="h2"
            className="text-5xl md:text-8xl font-bold tracking-wider uppercase"
          >
            {category}
          </GradientText>
        </div>
      </div>
    </div>
  );
}
