import { cn } from "@/lib/utils";

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";

export type StanVariant = 'waving' | 'talking' | 'thinking' | 'celebrating' | 'idle';
export type StanSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<StanSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-15 h-15',
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
  className?: string;
}

export function StanAvatar({ variant = 'idle', size = 'md', className }: StanAvatarProps) {
  const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/chatbot-assets/${variantFileMap[variant]}`;
  
  return (
    <img
      src={imageUrl}
      alt={`Stan ${variant}`}
      className={cn(sizeMap[size], "object-contain", className)}
    />
  );
}
