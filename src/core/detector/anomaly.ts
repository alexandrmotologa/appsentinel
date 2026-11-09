import crypto from 'node:crypto';
import type { DetectionConfig, MonitoredApp } from '../../types/config.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { IncidentCategory, IncidentSeverity, TriagedReview } from '../../types/review.js';
import type { ReviewStore } from '../storage/review-store.js';

export class SpikeDetector {
  private reviewStore: ReviewStore;

  constructor(reviewStore: ReviewStore) {
    this.reviewStore = reviewStore;
  }

  public detectSpikes(
    app: MonitoredApp,
    config: DetectionConfig
  ): IncidentCluster[] {
    const windowMinutes = app.windowMinutes || config.windowMinutes || 60;
    const threshold = app.spikeThreshold || config.spikeThreshold || 3;
    const minSeverity = config.minSeverity || 'P1_CRITICAL';

    const windowStartMs = Date.now() - windowMinutes * 60 * 1000;
    const windowStartIso = new Date(windowStartMs).toISOString();

    const reviews = this.reviewStore.getTriagedReviewsInWindow(app.appId, windowStartIso);

    if (reviews.length === 0) {
      return [];
    }

    // Group reviews into candidate clusters by (category, version)
    const clusterMap = new Map<string, TriagedReview[]>();

    for (const review of reviews) {
      // Filter out reviews that don't meet minimum severity
      if (!this.meetsSeverityThreshold(review.triage.severity, minSeverity)) {
        continue;
      }

      const versionKey = review.version || review.triage.extractedVersion || 'unknown';
      const clusterKey = `${app.appId}::${versionKey}::${review.triage.category}`;

      if (!clusterMap.has(clusterKey)) {
        clusterMap.set(clusterKey, []);
      }
      clusterMap.get(clusterKey)!.push(review);
    }

    const detectedSpikes: IncidentCluster[] = [];

    // Calculate baseline hourly rate over past 7 days
    const baselinePerHour = this.calculateBaselineHourlyRate(app.appId);

    for (const [key, clusterReviews] of clusterMap.entries()) {
      const windowHours = windowMinutes / 60;
      const hourlyRateInWindow = clusterReviews.length / windowHours;
      const velocityMultiplier = Number((hourlyRateInWindow / baselinePerHour).toFixed(2));

      const isThresholdBreach = clusterReviews.length >= threshold;
      const isVelocitySurge = clusterReviews.length >= 2 && velocityMultiplier >= 3.0;

      if (isThresholdBreach || isVelocitySurge) {
        const detectionReason = isThresholdBreach ? 'threshold_breach' : 'velocity_surge';
        const cluster = this.buildCluster(app, clusterReviews, velocityMultiplier, detectionReason);
        detectedSpikes.push(cluster);
      }
    }

    return detectedSpikes;
  }

  private calculateBaselineHourlyRate(appId: string): number {
    return this.reviewStore.calculateHistoricalHourlyRate(appId);
  }

  private meetsSeverityThreshold(severity: IncidentSeverity, minSeverity: IncidentSeverity): boolean {
    const severityRank: Record<IncidentSeverity, number> = {
      P1_CRITICAL: 4,
      P2_HIGH: 3,
      P3_MEDIUM: 2,
      P4_LOW: 1,
    };

    return severityRank[severity] >= severityRank[minSeverity];
  }

  private buildCluster(
    app: MonitoredApp,
    reviews: TriagedReview[],
    velocityMultiplier: number = 1.0,
    detectionReason: 'threshold_breach' | 'velocity_surge' = 'threshold_breach'
  ): IncidentCluster {
    // Sort reviews by date ascending
    const sorted = [...reviews].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstSeen = sorted[0].date;
    const lastSeen = sorted[sorted.length - 1].date;
    const category: IncidentCategory = sorted[0].triage.category;
    const appVersion = sorted[0].version || sorted[0].triage.extractedVersion || 'unknown';

    // Unique devices & OS
    const devices = new Set<string>();
    const osVersions = new Set<string>();
    let worstSeverity: IncidentSeverity = 'P4_LOW';

    const severityRank: Record<IncidentSeverity, number> = {
      P1_CRITICAL: 4,
      P2_HIGH: 3,
      P3_MEDIUM: 2,
      P4_LOW: 1,
    };

    for (const r of sorted) {
      if (r.triage.deviceModel) devices.add(r.triage.deviceModel);
      if (r.triage.osVersion) osVersions.add(r.triage.osVersion);
      if (severityRank[r.triage.severity] > severityRank[worstSeverity]) {
        worstSeverity = r.triage.severity;
      }
    }

    // Cluster fingerprint based on app, version, and category
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${app.appId}:${appVersion}:${category}`)
      .digest('hex')
      .substring(0, 16);

    const deviceSummary = devices.size > 0 ? Array.from(devices).slice(0, 3).join(', ') : 'Various devices';
    const rootCause = `${sorted.length} ${category} reports on ${app.name} v${appVersion} (${deviceSummary}).`;

    // Pick most common subsystem from reviews
    const subsystem = sorted[sorted.length - 1].triage.subsystem || 'UNKNOWN';
    const suggestedMitigation = sorted[sorted.length - 1].triage.suggestedMitigation || '';

    return {
      id: `cluster_${fingerprint}`,
      appId: app.appId,
      appName: app.name,
      platform: app.platform,
      category,
      subsystem,
      suggestedMitigation,
      appVersion,
      deviceModels: Array.from(devices),
      osVersions: Array.from(osVersions),
      reviewCount: sorted.length,
      velocityMultiplier,
      detectionReason,
      firstSeenAt: firstSeen,
      lastSeenAt: lastSeen,
      severity: worstSeverity,
      rootCauseSummary: rootCause,
      sampleReviews: sorted.slice(-3), // 3 most recent reviews
    };
  }
}
