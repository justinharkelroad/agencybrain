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
    title: 'CLOSING THE SALE',
    content:
      'When your sales team closes a piece of business, is there some sort of process and check points that they must complete to be done with that customer and have a clean handoff to the next step in the process',
  },
  {
    title: 'WELCOME TO THE FAMILY',
    content:
      "The onboarding process is not only important for first-year retention but it also gives us an incredible opportunity to ask better questions to a customer that we may have missed in the sales process. When you think about this inside of your agency, do you have a specific cadence that happens after someone onboards? How did you build that out? And how do you hold the person responsible for that to be done",
  },
  {
    title: "WHATS THE PROMISE?",
    content:
      "There's a lot of things we make promises about as a sales team member when we're trying to get someone to do business with us: We promise that we're going to review their policy at renewal. We promise certain things are going to happen in the first six months. As you think about it, I want you to consider are we doing the things that we are promising. If we are not promising things, could we add that to our sales process to give us a higher value proposition and close more deals",
  },
];

export function CustomersIntroSlide() {
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
            CUSTOMERS
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
