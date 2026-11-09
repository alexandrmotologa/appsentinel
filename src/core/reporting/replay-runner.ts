import type { DetectionConfig, MonitoredApp } from '../../types/config.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { RawReview } from '../../types/review.js';
import type { ReviewClassifier } from '../classifier/base.js';
import { SpikeDetector } from '../detector/anomaly.js';
import { CooldownManager } from '../detector/cooldown.js';
import { DatabaseManager } from '../storage/database.js';
import { IncidentStore } from '../storage/incident-store.js';
import { ReviewStore } from '../storage/review-store.js';

export interface ReplayResult {
  totalProcessed: number;
  triagedCount: number;
  skippedPositiveCount: number;
  detectedSpikes: IncidentCluster[];
  alertsTriggered: number;
  alertsSuppressed: number;
  durationMs: number;
}

export class ReplayRunner {
  private classifier: ReviewClassifier;

  constructor(classifier: ReviewClassifier) {
    this.classifier = classifier;
  }

  public async runReplay(
    reviews: RawReview[],
    app: MonitoredApp,
    config: DetectionConfig
  ): Promise<ReplayResult> {
    const startTime = Date.now();

    // Use an in-memory database for isolated replay execution
    const dbManager = new DatabaseManager(':memory:');
    const reviewStore = new ReviewStore(dbManager);
    const incidentStore = new IncidentStore(dbManager);
    const detector = new SpikeDetector(reviewStore);
    const cooldown = new CooldownManager(incidentStore);

    let triagedCount = 0;
    let skippedPositiveCount = 0;
    let alertsTriggered = 0;
    let alertsSuppressed = 0;
    const detectedSpikes: IncidentCluster[] = [];

    // Sort chronologically
    const sorted = [...reviews].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const raw of sorted) {
      const insert = reviewStore.insertReview(raw);

      if (raw.rating <= 2) {
        triagedCount++;
        const triage = await this.classifier.triage(raw);
        reviewStore.saveTriagedReview(
          {
            ...raw,
            fingerprint: insert.fingerprint,
            triage,
            triagedAt: new Date().toISOString(),
            classifierProvider: this.classifier.name,
          },
          insert.id
        );

        // Run detector after each triaged review to simulate real-time ingestion
        const spikes = detector.detectSpikes(app, config);
        for (const spike of spikes) {
          const evalResult = cooldown.evaluateCluster(spike, config);
          if (evalResult.shouldAlert) {
            alertsTriggered++;
            incidentStore.recordAlertDispatched(
              evalResult.incidentRecord.id,
              'replay_simulation',
              'sent',
              {}
            );
            if (!detectedSpikes.some((s) => s.id === spike.id)) {
              detectedSpikes.push(spike);
            }
          } else {
            alertsSuppressed++;
          }
        }
      } else {
        skippedPositiveCount++;
      }
    }

    dbManager.close();

    return {
      totalProcessed: sorted.length,
      triagedCount,
      skippedPositiveCount,
      detectedSpikes,
      alertsTriggered,
      alertsSuppressed,
      durationMs: Date.now() - startTime,
    };
  }
}
