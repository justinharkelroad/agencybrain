import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

export function GradientText({
  children,
  className,
  as: Component = 'span',
}: GradientTextProps) {
  return (
    <Component
      className={cn(
        'bg-gradient-to-r from-marketing-amber via-marketing-amber-light to-marketing-cyan bg-clip-text text-transparent',
        className
      )}
    >
      {children}
    </Component>
  );
}
