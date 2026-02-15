import { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { OnboardingSlide } from '@/components/slides/OnboardingSlide';
import { CustomersIntroSlide } from '@/components/slides/CustomersIntroSlide';

const QUESTIONS = [
  'What does the onboarding process look like?',
  'Who handles the onboarding process?',
  'How do you make sure it\'s being done as you require?',
  'What things do you make sure are on those calls?',
  'Do you ask for referrals at this time?',
  'Is this a good point for an EFS transition?',
  'Is it the sales team member who handles this stuff?',
  'Do you have a system built out to make sure it\'s being done?',
  'Is anything pre-scheduled during onboarding?',
];

export default function SlidesCustomers() {
  const [page, setPage] = useState(0);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${page * 100}%)` }}
      >
        <div className="w-full h-full flex-shrink-0">
          <CustomersIntroSlide />
        </div>
        <div className="w-full h-full flex-shrink-0">
          <OnboardingSlide category="CUSTOMERS" questions={QUESTIONS} />
        </div>
      </div>

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
