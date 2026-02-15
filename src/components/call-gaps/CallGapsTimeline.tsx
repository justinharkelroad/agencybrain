import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { AgentSummary, OfficeHours, ParsedCall, CallGap } from './types';

interface CallGapsTimelineProps {
  agents: AgentSummary[];
  officeHours: OfficeHours;
  gapThresholdMinutes: number;
  zoomLevel: number;
}

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 32;
const NAME_COL_WIDTH = 160;
const INBOUND_COLOR = '#1e3a5f';
const OUTBOUND_COLOR = '#4a9edd';

function formatTime12(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} sec`;
  return `${m} min ${s} sec`;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

interface TooltipData {
  x: number;
  y: number;
  content: React.ReactNode;
}

export default function CallGapsTimeline({
  agents,
  officeHours,
  gapThresholdMinutes,
  zoomLevel,
}: CallGapsTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const prevZoomRef = useRef(zoomLevel);
  const prevScrollRef = useRef(0);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width - NAME_COL_WIDTH);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Zoom scroll sync
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    const prevZoom = prevZoomRef.current;
    const prevScroll = prevScrollRef.current;
    if (prevZoom !== zoomLevel && prevZoom > 0) {
      const ratio = prevScroll / (containerWidth * prevZoom);
      scrollEl.scrollLeft = ratio * containerWidth * zoomLevel;
    }
    prevZoomRef.current = zoomLevel;
  }, [zoomLevel, containerWidth]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      prevScrollRef.current = scrollContainerRef.current.scrollLeft;
    }
  }, []);

  // Parse office hours to minutes from midnight
  const startMinutes = useMemo(() => {
    const [h, m] = officeHours.start.split(':').map(Number);
    return h * 60 + m;
  }, [officeHours.start]);

  const endMinutes = useMemo(() => {
    const [h, m] = officeHours.end.split(':').map(Number);
    return h * 60 + m;
  }, [officeHours.end]);

  const totalMinutes = endMinutes - startMinutes;
  const timelineWidth = Math.max(containerWidth * zoomLevel, containerWidth);

  // Generate hour markers (full hours and half hours within range)
  const hourMarkers = useMemo(() => {
    const markers: { minutes: number; isHour: boolean }[] = [];
    const firstHour = Math.ceil(startMinutes / 60) * 60;
    for (let m = firstHour; m <= endMinutes; m += 30) {
      if (m >= startMinutes) {
        markers.push({ minutes: m, isHour: m % 60 === 0 });
      }
    }
    return markers;
  }, [startMinutes, endMinutes]);

  // Pixel position for a given minutes-from-midnight value
  const minuteToPixel = useCallback(
    (mins: number) => ((mins - startMinutes) / totalMinutes) * timelineWidth,
    [startMinutes, totalMinutes, timelineWidth]
  );

  // Pixel position for a Date
  const dateToPixel = useCallback(
    (date: Date) => {
      const mins = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
      return minuteToPixel(mins);
    },
    [minuteToPixel]
  );

  // Tooltip handlers
  const showCallTooltip = useCallback(
    (e: React.MouseEvent, call: ParsedCall) => {
      const end = new Date(call.callStart.getTime() + call.durationSeconds * 1000);
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        content: (
          <div className="space-y-1">
            <p className="font-medium">{call.contactName || 'Unknown'}</p>
            {call.contactPhone && <p className="text-muted-foreground">{call.contactPhone}</p>}
            <p>{call.direction === 'inbound' ? 'Inbound' : 'Outbound'}</p>
            <p>
              {formatTime12(call.callStart)} — {formatTime12(end)}
            </p>
            <p>{formatDurationShort(call.durationSeconds)}</p>
          </div>
        ),
      });
    },
    []
  );

  const showGapTooltip = useCallback(
    (e: React.MouseEvent, gap: CallGap) => {
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        content: (
          <div className="space-y-1">
            <p className="font-medium">Gap: {formatDurationShort(gap.durationSeconds)}</p>
            <p>
              From {formatTime12(gap.gapStart)} to {formatTime12(gap.gapEnd)}
            </p>
          </div>
        ),
      });
    },
    []
  );

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const thresholdSeconds = gapThresholdMinutes * 60;

  return (
    <Card ref={containerRef}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Call Timeline</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4 px-4">
        <div className="flex border rounded-md overflow-hidden">
          {/* Fixed agent name column */}
          <div className="flex-shrink-0 border-r bg-background z-10" style={{ width: NAME_COL_WIDTH }}>
            <div
              className="border-b flex items-center px-2 text-xs font-medium text-muted-foreground"
              style={{ height: HEADER_HEIGHT }}
            >
              Agent
            </div>
            {agents.map((agent, idx) => (
              <div
                key={agent.agentName}
                className="flex items-center px-2 text-sm font-medium truncate border-b"
                style={{
                  height: ROW_HEIGHT,
                  background: idx % 2 === 0 ? 'hsl(var(--muted) / 0.3)' : 'transparent',
                }}
                title={agent.agentName}
              >
                {agent.agentName}
              </div>
            ))}
          </div>

          {/* Scrollable timeline area */}
          <div
            className="flex-1 overflow-x-auto"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <div style={{ width: timelineWidth, minWidth: '100%' }}>
              {/* Time axis header */}
              <div
                className="border-b relative bg-background z-20 sticky top-0"
                style={{ height: HEADER_HEIGHT }}
              >
                {hourMarkers
                  .filter((m) => m.isHour)
                  .map((marker) => (
                    <div
                      key={marker.minutes}
                      className="absolute text-[10px] text-muted-foreground"
                      style={{
                        left: minuteToPixel(marker.minutes),
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      {formatHour(marker.minutes / 60)}
                    </div>
                  ))}
              </div>

              {/* Agent rows */}
              {agents.map((agent, idx) => (
                <div
                  key={agent.agentName}
                  className="relative border-b"
                  style={{
                    height: ROW_HEIGHT,
                    background: idx % 2 === 0 ? 'hsl(var(--muted) / 0.3)' : 'transparent',
                  }}
                >
                  {/* Vertical gridlines */}
                  {hourMarkers.map((marker) => (
                    <div
                      key={marker.minutes}
                      className={`absolute top-0 bottom-0 w-px ${
                        marker.isHour ? 'bg-border/30' : 'bg-border/15 border-l border-dashed border-border/15'
                      }`}
                      style={{ left: minuteToPixel(marker.minutes) }}
                    />
                  ))}

                  {/* Noon marker */}
                  {720 >= startMinutes && 720 <= endMinutes && (
                    <div
                      className="absolute top-0 bottom-0 w-px border-l border-dashed border-yellow-500/30"
                      style={{ left: minuteToPixel(720) }}
                    />
                  )}

                  {/* Gap overlays (behind calls) */}
                  {agent.gaps
                    .filter((g) => g.durationSeconds >= thresholdSeconds)
                    .map((gap, gi) => {
                      const left = dateToPixel(gap.gapStart);
                      const right = dateToPixel(gap.gapEnd);
                      const width = Math.max(right - left, 2);
                      return (
                        <div
                          key={`gap-overlay-${gi}`}
                          className="absolute top-1 bottom-1 bg-red-500/10 border border-dashed border-red-500/30 rounded z-[1]"
                          style={{ left, width }}
                        />
                      );
                    })}

                  {/* Call blocks (on top) */}
                  {agent.calls.map((call, ci) => {
                    const left = dateToPixel(call.callStart);
                    const width = Math.max(
                      (call.durationSeconds / 60 / totalMinutes) * timelineWidth,
                      2
                    );
                    return (
                      <div
                        key={`call-${ci}`}
                        className="absolute top-[6px] h-7 rounded cursor-pointer z-[2]"
                        style={{
                          left,
                          width,
                          backgroundColor:
                            call.direction === 'inbound' ? INBOUND_COLOR : OUTBOUND_COLOR,
                        }}
                        onMouseEnter={(e) => showCallTooltip(e, call)}
                        onMouseMove={(e) =>
                          setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
                        }
                        onMouseLeave={hideTooltip}
                      />
                    );
                  })}

                  {/* Invisible gap hover targets */}
                  {agent.gaps.map((gap, gi) => {
                    const left = dateToPixel(gap.gapStart);
                    const right = dateToPixel(gap.gapEnd);
                    const width = Math.max(right - left, 0);
                    if (width < 1) return null;
                    return (
                      <div
                        key={`gap-hover-${gi}`}
                        className="absolute top-0 bottom-0 z-[1] cursor-help"
                        style={{ left, width }}
                        onMouseEnter={(e) => showGapTooltip(e, gap)}
                        onMouseMove={(e) =>
                          setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
                        }
                        onMouseLeave={hideTooltip}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: INBOUND_COLOR }} />
            Inbound
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: OUTBOUND_COLOR }} />
            Outbound
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/10 border border-dashed border-red-500/30" />
            Gap over threshold
          </div>
        </div>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-popover border rounded-md px-3 py-2 shadow-lg text-sm pointer-events-none"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 10,
            }}
          >
            {tooltip.content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
