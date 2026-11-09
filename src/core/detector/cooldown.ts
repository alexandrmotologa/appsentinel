import type { DetectionConfig } from '../../types/config.js';
import type { IncidentCluster, IncidentRecord } from '../../types/incident.js';
import type { IncidentStore } from '../storage/incident-store.js';

export interface CooldownEvaluation {
  shouldAlert: boolean;
  reason: 'new_incident' | 'cooldown_expired' | 'escalated' | 'cooldown_suppressed';
  incidentRecord: IncidentRecord;
}

export class CooldownManager {
  private incidentStore: IncidentStore;

  constructor(incidentStore: IncidentStore) {
    this.incidentStore = incidentStore;
  }

  public evaluateCluster(
    cluster: IncidentCluster,
    config: DetectionConfig
  ): CooldownEvaluation {
    const cooldownMs = (config.cooldownMinutes || 60) * 60 * 1000;
    const now = Date.now();

    const existing = this.incidentStore.getActiveIncidentByFingerprint(cluster.id);

    if (!existing) {
      // Brand new incident
      const record = this.incidentStore.upsertIncident(cluster, 'active');
      return {
        shouldAlert: true,
        reason: 'new_incident',
        incidentRecord: record,
      };
    }

    // Existing incident
    const lastAlertTime = existing.lastAlertAt
      ? new Date(existing.lastAlertAt).getTime()
      : 0;

    const timeSinceLastAlert = now - lastAlertTime;

    if (lastAlertTime === 0 || timeSinceLastAlert >= cooldownMs) {
      // Cooldown expired
      const updated = this.incidentStore.upsertIncident(cluster, 'active');
      return {
        shouldAlert: true,
        reason: 'cooldown_expired',
        incidentRecord: updated,
      };
    }

    // Inside cooldown: Check for significant escalation
    const reviewCountDiff = cluster.reviewCount - existing.reviewCount;
    const isEscalated =
      reviewCountDiff >= 3 ||
      (existing.severity !== 'P1_CRITICAL' && cluster.severity === 'P1_CRITICAL');

    if (isEscalated) {
      const updated = this.incidentStore.upsertIncident(cluster, 'active');
      return {
        shouldAlert: true,
        reason: 'escalated',
        incidentRecord: updated,
      };
    }

    // Suppressed by active cooldown
    const updated = this.incidentStore.upsertIncident(cluster, 'cooldown');
    return {
      shouldAlert: false,
      reason: 'cooldown_suppressed',
      incidentRecord: updated,
    };
  }
}
