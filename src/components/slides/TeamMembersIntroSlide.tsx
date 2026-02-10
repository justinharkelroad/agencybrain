import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GradientText } from '@/components/marketing/ui/GradientText';
import { motion, AnimatePresence } from 'framer-motion';

interface DrawerSection {
  title: string;
  content: string;
}

const SECTIONS: DrawerSection[] = [
  {
    title: 'EXPECTATIONS & COMP',
    content:
      "When you are recruiting someone, or putting out job ads and having interviews, how clear are you on the requirements you have in your agency for either production or the tasks that they're required to do on a daily basis? Specifically, when you're talking to salespeople, what is the normal position you take when explaining the potential comp they'll have? But also, the timeline it takes for them to ramp up to that potential",
  },
  {
    title: 'TRAINING',
    content:
      "What is the specific training timeline that you have when you hire a new team member? Do you have it mapped out in a document somewhere that allows them to check off each step as they go through? How long is your training? Is there a timeline where you want someone to be onboarded and through the training, or does it just take as long as it takes? Every person is different. Do you have video modules that you watch and they train upon, or do you rely upon third parties to train your team members",
  },
  {
    title: 'GRADUATION',
    content:
      "Do you have a timeline where they are handed off and considered free from the probation or onboarding experience of training? What does that look like? How often in the first year do you check in with a new employee and solidify some of the training you started with? Finally, do you have any sort of checkpoints throughout the first year to confirm acknowledgement of processes, but also happiness of the employee in the position",
  },
];

export function TeamMembersIntroSlide() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <div
      className="marketing-dark relative min-h-screen w-full overflow-hidden flex"
      style={{ background: 'var(--marketing-bg)' }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: 'var(--marketing-amber)', top: '-10%', left: '-5%' }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: 'var(--marketing-cyan)', bottom: '-10%', right: '-5%' }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center z-10 px-8 md:px-16">
        <div>
          <h1
            className="text-xl md:text-2xl font-semibold tracking-widest uppercase mb-2"
            style={{ color: 'var(--marketing-text)' }}
          >
            ONBOARDING
          </h1>
          <GradientText as="h2" className="text-5xl md:text-8xl font-bold tracking-wider uppercase">
            TEAM MEMBERS
          </GradientText>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center z-10 pr-8 md:pr-16 pl-4 gap-6">
        {SECTIONS.map((section, i) => (
          <div key={section.title}>
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between group cursor-pointer"
            >
              <h3
                className="text-xl md:text-3xl font-extrabold tracking-wide uppercase"
                style={{ color: 'var(--marketing-text)' }}
              >
                {section.title}
              </h3>
              <span className="ml-4 transition-transform duration-300" style={{ color: 'var(--marketing-text-muted)' }}>
                {openIndex === i ? <ChevronDown className="w-6 h-6 md:w-8 md:h-8" /> : <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {openIndex === i && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <p
                    className="pt-4 text-sm md:text-base font-semibold leading-relaxed max-w-lg"
                    style={{ color: 'var(--marketing-text)' }}
                  >
                    {section.content}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
