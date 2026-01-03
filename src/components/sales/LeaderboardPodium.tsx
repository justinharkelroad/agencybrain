import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PodiumEntry {
  rank: 1 | 2 | 3;
  name: string;
  initials: string;
  value: number;
  metric: 'premium' | 'items' | 'points';
  isCurrentUser?: boolean;
  premium?: number;
  items?: number;
  points?: number;
  policies?: number;
}

interface LeaderboardPodiumProps {
  topThree: PodiumEntry[];
  metric: 'premium' | 'items' | 'points';
}

const formatValue = (value: number, metric: 'premium' | 'items' | 'points') => {
  if (metric === 'premium') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return value.toLocaleString();
};

const getMedalColors = (rank: 1 | 2 | 3) => {
  switch (rank) {
    case 1:
      return {
        border: 'border-[#FFD700]',
        shadow: 'shadow-[0_0_25px_rgba(255,215,0,0.5)]',
        glow: 'rgba(255, 215, 0, 0.4)',
        bg: 'bg-gradient-to-br from-[#FFD700]/20 to-[#FFA500]/10',
        text: 'text-[#FFD700]',
      };
    case 2:
      return {
        border: 'border-[#C0C0C0]',
        shadow: 'shadow-[0_0_20px_rgba(192,192,192,0.4)]',
        glow: 'rgba(192, 192, 192, 0.3)',
        bg: 'bg-gradient-to-br from-[#C0C0C0]/20 to-[#A8A8A8]/10',
        text: 'text-[#C0C0C0]',
      };
    case 3:
      return {
        border: 'border-[#CD7F32]',
        shadow: 'shadow-[0_0_20px_rgba(205,127,50,0.4)]',
        glow: 'rgba(205, 127, 50, 0.3)',
        bg: 'bg-gradient-to-br from-[#CD7F32]/20 to-[#B8860B]/10',
        text: 'text-[#CD7F32]',
      };
  }
};

const getMedal = (rank: 1 | 2 | 3) => {
  switch (rank) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
  }
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

interface PodiumPlaceProps {
  entry: PodiumEntry;
  metric: 'premium' | 'items' | 'points';
  animationDelay: number;
}

function PodiumPlace({ entry, metric, animationDelay }: PodiumPlaceProps) {
  const colors = getMedalColors(entry.rank);
  const isFirst = entry.rank === 1;
  const avatarSize = isFirst ? 'w-20 h-20' : 'w-16 h-16';
  const fontSize = isFirst ? 'text-2xl' : 'text-xl';

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: animationDelay,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={cn(
        "flex flex-col items-center transition-transform duration-300 hover:-translate-y-2 cursor-default",
        entry.rank === 1 && "order-2 mb-8",
        entry.rank === 2 && "order-1 mb-4",
        entry.rank === 3 && "order-3 mb-0"
      )}
    >
      {/* Medal Badge */}
      <motion.div 
        className="text-3xl mb-2"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20, 
          delay: animationDelay + 0.2 
        }}
      >
        {getMedal(entry.rank)}
      </motion.div>

      {/* Avatar Ring */}
      <div
        className={cn(
          avatarSize,
          "rounded-full flex items-center justify-center relative",
          "border-[3px]",
          colors.border,
          colors.shadow,
          colors.bg,
          "transition-all duration-300",
          entry.isCurrentUser && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        style={{
          animation: 'avatarPulse 2s ease-in-out infinite',
        }}
      >
        <span className={cn(fontSize, "font-bold text-foreground")}>
          {entry.initials || getInitials(entry.name)}
        </span>
        
        {/* Current User Badge */}
        {entry.isCurrentUser && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            YOU
          </div>
        )}
      </div>

      {/* Name */}
      <p className={cn(
        "mt-3 font-semibold text-foreground text-center max-w-[100px] truncate",
        isFirst ? "text-base" : "text-sm"
      )}>
        {entry.name}
      </p>

      {/* Primary Metric Value */}
      <motion.p 
        className={cn(
          "font-bold mt-1",
          colors.text,
          isFirst ? "text-xl" : "text-lg"
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: animationDelay + 0.4 }}
      >
        {formatValue(entry.value, metric)}
      </motion.p>

      {/* Secondary Stats (on hover - simplified for now) */}
      <p className="text-xs text-muted-foreground mt-1">
        {entry.items ?? 0} items • {entry.policies ?? 0} policies
      </p>
    </motion.div>
  );
}

function EmptyPodiumPlace({ rank }: { rank: 1 | 2 | 3 }) {
  const colors = getMedalColors(rank);
  const isFirst = rank === 1;
  const avatarSize = isFirst ? 'w-20 h-20' : 'w-16 h-16';

  return (
    <div
      className={cn(
        "flex flex-col items-center opacity-40",
        rank === 1 && "order-2 mb-8",
        rank === 2 && "order-1 mb-4",
        rank === 3 && "order-3 mb-0"
      )}
    >
      <div className="text-3xl mb-2 grayscale">{getMedal(rank)}</div>
      <div
        className={cn(
          avatarSize,
          "rounded-full flex items-center justify-center",
          "border-[3px] border-dashed",
          colors.border,
          "bg-muted/20"
        )}
      >
        <span className="text-muted-foreground text-lg">?</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground italic">
        Claim this spot!
      </p>
    </div>
  );
}

export function LeaderboardPodium({ topThree, metric }: LeaderboardPodiumProps) {
  // Animation delays: 2nd, 1st, 3rd (staggered entrance)
  const delays = { 1: 0.2, 2: 0, 3: 0.4 };

  // Create ordered entries for podium positions
  const orderedEntries = [1, 2, 3].map(rank => {
    const entry = topThree.find(e => e.rank === rank);
    return entry || null;
  });

  // Check if we have any entries with value > 0
  const hasEntries = topThree.some(e => e.value > 0);

  if (!hasEntries) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex items-end justify-center gap-4 sm:gap-8">
          <EmptyPodiumPlace rank={2} />
          <EmptyPodiumPlace rank={1} />
          <EmptyPodiumPlace rank={3} />
        </div>
        <p className="mt-6 text-muted-foreground text-center">
          Be the first to make a sale and claim the top spot!
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-4 sm:gap-8 py-6">
      {orderedEntries.map((entry, index) => {
        const rank = (index + 1) as 1 | 2 | 3;
        if (entry && entry.value > 0) {
          return (
            <PodiumPlace
              key={entry.name}
              entry={entry}
              metric={metric}
              animationDelay={delays[rank]}
            />
          );
        }
        return <EmptyPodiumPlace key={rank} rank={rank} />;
      })}
    </div>
  );
}
