import { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { OnboardingSlide } from '@/components/slides/OnboardingSlide';
import { ProspectsIntroSlide } from '@/components/slides/ProspectsIntroSlide';

const QUESTIONS = [
  'How do you make sure your team is following up?',
  'What is your follow-up process?',
  'How fast do you get to your potential leads?',
  'How do you assign your leads to your sales team?',
  "Who's responsible to make sure the process is being done?",
  'How do you track the effectiveness of your team?',
  'Do you have people who are more consistent than others inside of converting new prospects to households?',
  'How do you train on the front end to convert leads to quotes?',
];

export default function SlidesProspects() {
  const [page, setPage] = useState(0);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Slides container */}
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${page * 100}%)` }}
      >
        <div className="w-full h-full flex-shrink-0">
          <ProspectsIntroSlide />
        </div>
        <div className="w-full h-full flex-shrink-0">
          <OnboardingSlide category="PROSPECTS" questions={QUESTIONS} />
        </div>
      </div>

      {/* Navigation arrows */}
      {page === 0 && (
        <button
          onClick={() => setPage(1)}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Next slide"
        >
          <ChevronRight className="w-8 h-8" style={{ color: 'var(--marketing-text)' }} />
        </button>
      )}
      {page === 1 && (
        <button
          onClick={() => setPage(0)}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-8 h-8" style={{ color: 'var(--marketing-text)' }} />
        </button>
      )}
    </div>
  );
}
