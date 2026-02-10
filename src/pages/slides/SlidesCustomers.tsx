import { OnboardingSlide } from '@/components/slides/OnboardingSlide';

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
  return <OnboardingSlide category="CUSTOMERS" questions={QUESTIONS} />;
}
