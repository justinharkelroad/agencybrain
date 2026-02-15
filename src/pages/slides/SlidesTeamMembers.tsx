import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { OnboardingSlide } from '@/components/slides/OnboardingSlide';
import { TeamMembersIntroSlide } from '@/components/slides/TeamMembersIntroSlide';

const QUESTIONS = [
  'What is the ideal timeline to have someone onboarded in either sales or service?',
  'Do you have training mapped out so people know exactly what to do and when to do it?',
  "Who's responsible for seeing a new member through training?",
  'Has your past process been effective?',
  'How do you know your onboarding is successful?',
  'Are there clear frameworks for them to understand what\'s important and what to focus on?',
  'How often do you revamp your training based upon new processes?',
  'What do you feel like someone coming out of training should be perfectly prepared for?',
  'Do you use specific software to track training modules?',
];

export default function SlidesTeamMembers() {
  const [page, setPage] = useState(0);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ width: '200%', transform: `translateX(-${page * 50}%)` }}
      >
        <div className="w-1/2 h-full flex-shrink-0">
          <TeamMembersIntroSlide />
        </div>
        <div className="w-1/2 h-full flex-shrink-0">
          <OnboardingSlide category="TEAM MEMBERS" questions={QUESTIONS} />
        </div>
      </div>

      {page === 0 && (
        <button
          onClick={() => setPage(1)}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-8 h-8" style={{ color: 'var(--marketing-text)' }} />
        </button>
      )}
      {page === 1 && (
        <button
          onClick={() => setPage(0)}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-8 h-8" style={{ color: 'var(--marketing-text)' }} />
        </button>
      )}
    </div>
  );
}
