import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { JourneyEvent, LifecycleStage } from '@/types/contact';
import { LIFECYCLE_STAGE_CONFIGS } from '@/types/contact';

interface CustomerJourneyProps {
  events: JourneyEvent[];
  currentStage: LifecycleStage;
}

// Define the standard journey stages in order
const JOURNEY_STAGES: LifecycleStage[] = [
  'lead',
  'customer',
  'renewal',
  'at_risk',
  'winback',
];

export function CustomerJourney({ events, currentStage }: CustomerJourneyProps) {
  // Build a map of the most recent event for each stage
  const stageEvents = new Map<LifecycleStage, JourneyEvent>();
  events.forEach(event => {
    // Keep the first (most recent after sorting) event for each stage
    if (!stageEvents.has(event.stage)) {
      stageEvents.set(event.stage, event);
    }
  });

  // Determine which stages have been reached
  const reachedStages = new Set<LifecycleStage>();
  events.forEach(event => reachedStages.add(event.stage));

  // Find the current stage index
  const currentStageIndex = JOURNEY_STAGES.indexOf(currentStage);

  return (
    <div className="py-4">
      {/* Timeline visualization */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{
            width: `${Math.min((currentStageIndex / (JOURNEY_STAGES.length - 1)) * 100, 100)}%`,
          }}
        />

        {/* Stage markers */}
        <div className="relative flex justify-between">
          {JOURNEY_STAGES.map((stage, index) => {
            const config = LIFECYCLE_STAGE_CONFIGS[stage];
            const event = stageEvents.get(stage);
            const isReached = reachedStages.has(stage);
            const isCurrent = stage === currentStage;
            const isPast = index < currentStageIndex;

            return (
              <div
                key={stage}
                className="flex flex-col items-center"
                style={{ width: `${100 / JOURNEY_STAGES.length}%` }}
              >
                {/* Marker dot */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all z-10 bg-background',
                    isCurrent && 'border-primary bg-primary text-primary-foreground scale-110',
                    isPast && 'border-primary bg-primary/20',
                    !isReached && !isCurrent && !isPast && 'border-muted bg-muted'
                  )}
                >
                  {config.icon}
                </div>

                {/* Stage label */}
                <span
                  className={cn(
                    'text-xs mt-2 font-medium text-center',
                    isCurrent && 'text-primary',
                    !isReached && !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {config.label}
                </span>

                {/* Date if event exists */}
                {event && (
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(event.date), 'MMM yyyy')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status indicator */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Current Status:</span>
        <span className={cn('text-sm font-medium', LIFECYCLE_STAGE_CONFIGS[currentStage].color)}>
          {LIFECYCLE_STAGE_CONFIGS[currentStage].icon} {LIFECYCLE_STAGE_CONFIGS[currentStage].label}
        </span>
      </div>
    </div>
  );
}

// Compact version for inline display
export function CustomerJourneyCompact({ currentStage }: { currentStage: LifecycleStage }) {
  const config = LIFECYCLE_STAGE_CONFIGS[currentStage];

  return (
    <div className={cn('inline-flex items-center gap-1.5 text-sm', config.color)}>
      <span>{config.icon}</span>
      <span className="font-medium">{config.label}</span>
    </div>
  );
}

// Badge version for tables/lists
export function CustomerJourneyBadge({ currentStage }: { currentStage: LifecycleStage }) {
  const config = LIFECYCLE_STAGE_CONFIGS[currentStage];

  const bgColors: Record<LifecycleStage, string> = {
    lead: 'bg-blue-100 text-blue-700 border-blue-200',
    customer: 'bg-green-100 text-green-700 border-green-200',
    renewal: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    at_risk: 'bg-orange-100 text-orange-700 border-orange-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    winback: 'bg-purple-100 text-purple-700 border-purple-200',
    won_back: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
        bgColors[currentStage]
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export default CustomerJourney;
