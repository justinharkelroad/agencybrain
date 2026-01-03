import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LeaderboardListEntry {
  rank: number;
  name: string;
  premium: number;
  items: number;
  points: number;
  policies: number;
  households: number;
  isCurrentUser?: boolean;
  team_member_id: string;
}

interface LeaderboardListProps {
  producers: LeaderboardListEntry[];
  startRank: number;
  metric: 'premium' | 'items' | 'points' | 'households';
}

const formatCurrency = (value: number) => {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export function LeaderboardList({ producers, startRank, metric }: LeaderboardListProps) {
  if (producers.length === 0) return null;

  return (
    <div className="space-y-2 mt-6">
      {/* Header */}
      <div className="flex gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-10 shrink-0">#</div>
        <div className="flex-1 min-w-0">Name</div>
        <div className={cn("w-20 text-right shrink-0", metric === 'premium' && "text-foreground font-bold")}>
          Premium
        </div>
        <div className={cn("w-14 text-right shrink-0", metric === 'items' && "text-foreground font-bold")}>
          Items
        </div>
        <div className={cn("w-14 text-right shrink-0", metric === 'points' && "text-foreground font-bold")}>
          Points
        </div>
        <div className="w-14 text-right shrink-0">Policies</div>
        <div className={cn("w-14 text-right shrink-0", metric === 'households' && "text-foreground font-bold")}>
          HH
        </div>
      </div>

      {/* List Items */}
      {producers.map((producer, index) => {
        const actualRank = startRank + index;
        
        return (
          <motion.div
            key={producer.team_member_id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: 0.5 + (index * 0.05),
              ease: [0.4, 0, 0.2, 1]
            }}
            className={cn(
              "flex gap-2 px-4 py-3 rounded-lg transition-all duration-200",
              "hover:translate-x-1 hover:shadow-md cursor-default",
              "bg-card/50 backdrop-blur-sm border border-border/50",
              index % 2 === 0 ? "bg-muted/5" : "bg-transparent",
              producer.isCurrentUser && [
                "border-primary/50 bg-primary/5",
                "shadow-[0_0_15px_rgba(var(--primary),0.15)]"
              ]
            )}
          >
            {/* Rank Badge */}
            <div className="w-10 shrink-0 flex items-center">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold",
                "bg-muted text-muted-foreground",
                producer.isCurrentUser && "bg-primary/20 text-primary"
              )}>
                {actualRank}
              </div>
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0 flex items-center">
              <span className={cn(
                "font-medium truncate",
                producer.isCurrentUser && "text-primary"
              )}>
                {producer.name}
              </span>
              {producer.isCurrentUser && (
                <span className="ml-2 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">
                  YOU
                </span>
              )}
            </div>

            {/* Premium */}
            <div className={cn(
              "w-20 shrink-0 flex items-center justify-end text-sm",
              metric === 'premium' && "font-bold text-foreground"
            )}>
              {formatCurrency(producer.premium)}
            </div>

            {/* Items */}
            <div className={cn(
              "w-14 shrink-0 flex items-center justify-end text-sm",
              metric === 'items' && "font-bold text-foreground"
            )}>
              {producer.items}
            </div>

            {/* Points */}
            <div className={cn(
              "w-14 shrink-0 flex items-center justify-end text-sm",
              metric === 'points' && "font-bold text-foreground"
            )}>
              {producer.points}
            </div>

            {/* Policies */}
            <div className="w-14 shrink-0 flex items-center justify-end text-sm text-muted-foreground">
              {producer.policies}
            </div>

            {/* Households */}
            <div className={cn(
              "w-14 shrink-0 flex items-center justify-end text-sm",
              metric === 'households' && "font-bold text-foreground"
            )}>
              {producer.households}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Mobile-friendly card version
export function LeaderboardListMobile({ producers, startRank, metric }: LeaderboardListProps) {
  if (producers.length === 0) return null;

  return (
    <div className="space-y-3 mt-6">
      {producers.map((producer, index) => {
        const actualRank = startRank + index;
        
        return (
          <motion.div
            key={producer.team_member_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: 0.5 + (index * 0.05),
              ease: [0.4, 0, 0.2, 1]
            }}
            className={cn(
              "p-4 rounded-xl transition-all duration-200",
              "bg-card/50 backdrop-blur-sm border border-border/50",
              producer.isCurrentUser && [
                "border-primary/50 bg-primary/5",
                "shadow-[0_0_15px_rgba(var(--primary),0.15)]"
              ]
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  "bg-muted text-muted-foreground",
                  producer.isCurrentUser && "bg-primary/20 text-primary"
                )}>
                  #{actualRank}
                </div>
                <span className={cn(
                  "font-semibold",
                  producer.isCurrentUser && "text-primary"
                )}>
                  {producer.name}
                </span>
              </div>
              {producer.isCurrentUser && (
                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  YOU
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className={cn(metric === 'premium' && "font-bold")}>
                <p className="text-xs text-muted-foreground mb-0.5">Premium</p>
                <p className="text-sm">{formatCurrency(producer.premium)}</p>
              </div>
              <div className={cn(metric === 'items' && "font-bold")}>
                <p className="text-xs text-muted-foreground mb-0.5">Items</p>
                <p className="text-sm">{producer.items}</p>
              </div>
              <div className={cn(metric === 'points' && "font-bold")}>
                <p className="text-xs text-muted-foreground mb-0.5">Points</p>
                <p className="text-sm">{producer.points}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Policies</p>
                <p className="text-sm text-muted-foreground">{producer.policies}</p>
              </div>
              <div className={cn(metric === 'households' && "font-bold")}>
                <p className="text-xs text-muted-foreground mb-0.5">HH</p>
                <p className="text-sm">{producer.households}</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
