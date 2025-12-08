interface FlowProgressProps {
  current: number;
  total: number;
  percentage: number;
}

export function FlowProgress({ current, total, percentage }: FlowProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {current} of {total}</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
