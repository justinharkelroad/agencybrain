import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";

export type StanVariant = 'waving' | 'talking' | 'thinking' | 'celebrating' | 'idle';
export type StanSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<StanSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

const variantFileMap: Record<StanVariant, string> = {
  waving: 'stan-waving.png',
  talking: 'stan-talking.png',
  thinking: 'stan-thinking.png',
  celebrating: 'stan-celebrating.png',
  idle: 'stan-idle.png',
};

interface StanAvatarProps {
  variant?: StanVariant;
  size?: StanSize;
  animate?: boolean;
  className?: string;
}

export function StanAvatar({ variant = 'idle', size = 'md', animate = true, className }: StanAvatarProps) {
  const [currentVariant, setCurrentVariant] = useState(variant);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (variant !== currentVariant) {
      setIsTransitioning(true);
      // Brief fade out then switch
      const timeout = setTimeout(() => {
        setCurrentVariant(variant);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [variant, currentVariant]);

  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/chatbot-assets/${variantFileMap[currentVariant]}`;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <img
        src={imageUrl}
        alt={`Stan ${currentVariant}`}
        className={cn(
          sizeMap[size],
          "object-contain transition-all duration-200",
          isTransitioning && "opacity-0 scale-95",
          !isTransitioning && "opacity-100 scale-100",
          // State-specific animations
          animate && currentVariant === 'thinking' && "animate-pulse",
          animate && currentVariant === 'celebrating' && "animate-bounce"
        )}
      />
      
      {/* Thinking indicator dots */}
      {animate && currentVariant === 'thinking' && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '600ms' }} 
          />
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '150ms', animationDuration: '600ms' }} 
          />
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '300ms', animationDuration: '600ms' }} 
          />
        </div>
      )}
    </div>
  );
}