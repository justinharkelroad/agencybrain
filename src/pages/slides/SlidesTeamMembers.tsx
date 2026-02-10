import { OnboardingSlide } from '@/components/slides/OnboardingSlide';

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
  return <OnboardingSlide category="TEAM MEMBERS" questions={QUESTIONS} />;
}
