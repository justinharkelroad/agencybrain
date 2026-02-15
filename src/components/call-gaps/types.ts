export interface ParsedCall {
  agentName: string;
  callStart: Date;
  durationSeconds: number;
  direction: 'inbound' | 'outbound';
  contactName: string;
  contactPhone: string;
  result: string;
}

export interface CallGap {
  agentName: string;
  gapStart: Date;
  gapEnd: Date;
  durationSeconds: number;
  callBefore: ParsedCall | null;
  callAfter: ParsedCall | null;
}

export interface AgentSummary {
  agentName: string;
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalTalkSeconds: number;
  inboundTalkSeconds: number;
  outboundTalkSeconds: number;
  calls: ParsedCall[];
  gaps: CallGap[];
}

export interface ParseResult {
  agents: AgentSummary[];
  availableDates: string[]; // ISO date strings YYYY-MM-DD
  sourceFormat: 'ringcentral' | 'ricochet';
  rawCallCount: number;
}

export interface OfficeHours {
  start: string; // "08:00"
  end: string;   // "18:00"
}
