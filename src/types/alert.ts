import type { IncidentCluster } from './incident.js';

export interface AlertPayload {
  event: 'incident.spike_detected' | 'incident.escalated' | 'incident.resolved';
  incident: IncidentCluster;
  channel: 'slack' | 'telegram' | 'webhook';
  timestamp: string;
}

export interface DispatchResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
  durationMs: number;
}
