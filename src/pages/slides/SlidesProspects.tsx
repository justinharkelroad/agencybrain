import { OnboardingSlide } from '@/components/slides/OnboardingSlide';

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
  return <OnboardingSlide category="PROSPECTS" questions={QUESTIONS} />;
}
