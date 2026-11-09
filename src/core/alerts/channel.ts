import type { DispatchResult } from '../../types/alert.js';
import type { IncidentCluster } from '../../types/incident.js';

export interface AlertChannel {
  readonly name: string;
  readonly isEnabled: boolean;
  sendAlert(incident: IncidentCluster, reason?: string): Promise<DispatchResult>;
}
