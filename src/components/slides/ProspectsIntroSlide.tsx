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
    title: 'MARKETING',
    content:
      'How we go about gaining access to new leads and how often we revamp these processes. Another point inside of this box, as you think about it, is how often do we track the ROI or even the cost per opportunity to make sure we\'re being efficient with our money',
  },
  {
    title: 'MANAGEMENT',
    content:
      'No matter what system we use, management is a key indicator of how well and organized we stay with our data. Inside of the area of management, when we talk about onboarding prospects, I want you to consider how well we remain aware of the efficiency of our management systems and if there\'s someone assigned to ensure things are being caught that we don\'t have the capacity to see',
  },
  {
    title: 'FOLLOW UP & THROUGH',
    content:
      'The specific plans or actions that you assigned to your team members is their lifeblood to success. As you brainstorm inside of onboarding prospects, it\'s time to become truthful on how well you\'ve clearly defined what follow-up and follow-through looks like inside of your agency on your sales teams. And also, how well you are making sure that this process is being followed',
  },
];

export function ProspectsIntroSlide() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <div
      className="marketing-dark relative min-h-screen w-full overflow-hidden flex"
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

      {/* Left side - Title */}
      <div className="flex-1 flex items-center justify-center z-10 px-8 md:px-16">
        <div>
          <h1
            className="text-xl md:text-2xl font-semibold tracking-widest uppercase mb-2"
            style={{ color: 'var(--marketing-text)' }}
          >
            ONBOARDING
          </h1>
          <GradientText
            as="h2"
            className="text-5xl md:text-8xl font-bold tracking-wider uppercase"
          >
            PROSPECTS
          </GradientText>
        </div>
      </div>

      {/* Right side - Accordion drawers */}
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
              <span
                className="ml-4 transition-transform duration-300"
                style={{ color: 'var(--marketing-text-muted)' }}
              >
                {openIndex === i ? (
                  <ChevronDown className="w-6 h-6 md:w-8 md:h-8" />
                ) : (
                  <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                )}
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
