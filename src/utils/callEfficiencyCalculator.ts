import { ParsedCall } from './callLogParser';

export interface UserCallMetrics {
  user: string;
  totalCalls: number;
  callsOverThreshold: number;
  avgDurationSeconds: number;
  totalTalkTimeSeconds: number;
  longestCallSeconds: number;
  inboundCalls: number;
  outboundCalls: number;
  connectRate: number;
  callsByHour: number[];
}

export interface CallEfficiencyResults {
  thresholdMinutes: number;
  users: UserCallMetrics[];
  totals: {
    totalCalls: number;
    callsOverThreshold: number;
    avgDurationSeconds: number;
    totalTalkTimeSeconds: number;
    inboundCalls: number;
    outboundCalls: number;
    connectRate: number;
  };
  dateRange: { start: Date; end: Date };
}

export function calculateCallEfficiency(
  calls: ParsedCall[],
  thresholdMinutes: number,
  dateFilter?: { start: Date; end: Date }
): CallEfficiencyResults {
  // Filter by date if provided
  let filteredCalls = calls;
  if (dateFilter) {
    const startOfDay = new Date(dateFilter.start);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateFilter.end);
    endOfDay.setHours(23, 59, 59, 999);
    
    filteredCalls = calls.filter(call => {
      const callDate = new Date(call.dateTime);
      return callDate >= startOfDay && callDate <= endOfDay;
    });
  }

  // Group calls by user
  const userCallsMap = new Map<string, ParsedCall[]>();
  filteredCalls.forEach(call => {
    const existing = userCallsMap.get(call.user) || [];
    existing.push(call);
    userCallsMap.set(call.user, existing);
  });

  const thresholdSeconds = thresholdMinutes * 60;

  // Calculate metrics per user
  const userMetrics: UserCallMetrics[] = [];
  
  userCallsMap.forEach((userCalls, userName) => {
    const callsByHour = new Array(24).fill(0);
    let totalDuration = 0;
    let callsOverThreshold = 0;
    let longestCall = 0;
    let inboundCalls = 0;
    let outboundCalls = 0;
    let connectedCalls = 0;

    userCalls.forEach(call => {
      totalDuration += call.durationSeconds;
      
      if (call.durationSeconds >= thresholdSeconds) {
        callsOverThreshold++;
      }
      
      if (call.durationSeconds > longestCall) {
        longestCall = call.durationSeconds;
      }
      
      if (call.direction === 'inbound') {
        inboundCalls++;
      } else if (call.direction === 'outbound') {
        outboundCalls++;
      }
      
      if (call.connected) {
        connectedCalls++;
      }
      
      const hour = new Date(call.dateTime).getHours();
      callsByHour[hour]++;
    });

    userMetrics.push({
      user: userName,
      totalCalls: userCalls.length,
      callsOverThreshold,
      avgDurationSeconds: userCalls.length > 0 ? Math.round(totalDuration / userCalls.length) : 0,
      totalTalkTimeSeconds: totalDuration,
      longestCallSeconds: longestCall,
      inboundCalls,
      outboundCalls,
      connectRate: userCalls.length > 0 ? Math.round((connectedCalls / userCalls.length) * 100) : 0,
      callsByHour,
    });
  });

  // Sort by calls over threshold (descending)
  userMetrics.sort((a, b) => b.callsOverThreshold - a.callsOverThreshold);

  // Calculate totals
  const totalCalls = filteredCalls.length;
  const totalDuration = filteredCalls.reduce((sum, call) => sum + call.durationSeconds, 0);
  const callsOverThreshold = filteredCalls.filter(call => call.durationSeconds >= thresholdSeconds).length;
  const connectedCalls = filteredCalls.filter(call => call.connected).length;
  const inboundCalls = filteredCalls.filter(call => call.direction === 'inbound').length;
  const outboundCalls = filteredCalls.filter(call => call.direction === 'outbound').length;

  // Determine date range from filtered calls
  let dateRange = { start: new Date(), end: new Date() };
  if (filteredCalls.length > 0) {
    const dates = filteredCalls.map(call => new Date(call.dateTime).getTime());
    dateRange = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }

  return {
    thresholdMinutes,
    users: userMetrics,
    totals: {
      totalCalls,
      callsOverThreshold,
      avgDurationSeconds: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      totalTalkTimeSeconds: totalDuration,
      inboundCalls,
      outboundCalls,
      connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
    },
    dateRange,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function formatTalkTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}
