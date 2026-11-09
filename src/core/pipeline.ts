import type { AppSentinelConfig, MonitoredApp } from '../types/config.js';
import type { IncidentCluster } from '../types/incident.js';
import type { RawReview } from '../types/review.js';
import { AlertDispatcher } from './alerts/dispatcher.js';
import { ClassifierFactory } from './classifier/factory.js';
import type { ReviewClassifier } from './classifier/base.js';
import { SpikeDetector } from './detector/anomaly.js';
import { CooldownManager } from './detector/cooldown.js';
import { AppStoreFetcher } from './fetchers/app-store.js';
import { GooglePlayFetcher } from './fetchers/google-play.js';
import { DatabaseManager } from './storage/database.js';
import { IncidentStore } from './storage/incident-store.js';
import { ReviewStore } from './storage/review-store.js';

export interface PipelineCycleResult {
  appsChecked: number;
  newReviewsCount: number;
  triagedCount: number;
  spikesDetected: IncidentCluster[];
  alertsDispatched: number;
  durationMs: number;
}

export class MonitoringPipeline {
  private config: AppSentinelConfig;
  private dbManager: DatabaseManager;
  private reviewStore: ReviewStore;
  private incidentStore: IncidentStore;
  private classifier: ReviewClassifier;
  private detector: SpikeDetector;
  private cooldown: CooldownManager;
  private dispatcher: AlertDispatcher;
  private appStoreFetcher: AppStoreFetcher;
  private googlePlayFetcher: GooglePlayFetcher;

  constructor(config: AppSentinelConfig, dbManager?: DatabaseManager) {
    this.config = config;
    this.dbManager = dbManager || new DatabaseManager(config.databasePath);
    this.reviewStore = new ReviewStore(this.dbManager);
    this.incidentStore = new IncidentStore(this.dbManager);
    this.classifier = ClassifierFactory.create(config.classifier);
    this.detector = new SpikeDetector(this.reviewStore);
    this.cooldown = new CooldownManager(this.incidentStore);
    this.dispatcher = new AlertDispatcher(config.alerts, this.incidentStore);
    this.appStoreFetcher = new AppStoreFetcher();
    this.googlePlayFetcher = new GooglePlayFetcher();
  }

  public getDbManager(): DatabaseManager {
    return this.dbManager;
  }

  public getIncidentStore(): IncidentStore {
    return this.incidentStore;
  }

  public getReviewStore(): ReviewStore {
    return this.reviewStore;
  }

  public async runCycle(options: { dryRun?: boolean; verbose?: boolean } = {}): Promise<PipelineCycleResult> {
    const startTime = Date.now();
    let newReviewsCount = 0;
    let triagedCount = 0;
    let alertsDispatched = 0;
    const spikesDetected: IncidentCluster[] = [];

    const apps = this.config.apps;

    for (const app of apps) {
      if (options.verbose) {
        console.log(`[Pipeline] Checking ${app.name} (${app.platform.toUpperCase()} - ${app.appId})...`);
      }

      // 1. Fetch reviews
      let rawReviews: RawReview[] = [];
      try {
        if (app.platform === 'ios') {
          rawReviews = await this.appStoreFetcher.fetchReviews(app);
        } else if (app.platform === 'android') {
          rawReviews = await this.googlePlayFetcher.fetchReviews(app);
        }
      } catch (err) {
        console.warn(`[Pipeline] Fetch error for ${app.name}:`, err instanceof Error ? err.message : String(err));
      }

      // 2. Ingest & Deduplicate
      const pendingDbIds: Array<{ id: number; raw: RawReview }> = [];

      for (const review of rawReviews) {
        const insertResult = this.reviewStore.insertReview(review);
        if (insertResult.inserted) {
          newReviewsCount++;
          if (review.rating <= 2) {
            pendingDbIds.push({ id: insertResult.id, raw: review });
          }
        }
      }

      // 3. Triage negative reviews
      for (const item of pendingDbIds) {
        try {
          const triage = await this.classifier.triage(item.raw);
          this.reviewStore.saveTriagedReview(
            {
              ...item.raw,
              fingerprint: ReviewStore.generateFingerprint(item.raw.platform, item.raw.appId, item.raw.id),
              triage,
              triagedAt: new Date().toISOString(),
              classifierProvider: this.classifier.name,
            },
            item.id
          );
          triagedCount++;
        } catch (err) {
          console.warn(`[Pipeline] Triage failed for review ${item.raw.id}:`, err);
        }
      }

      // 4. Anomaly & Spike Detection
      const spikes = this.detector.detectSpikes(app, this.config.detection);

      for (const spike of spikes) {
        spikesDetected.push(spike);

        // 5. Cooldown & Alerting
        const evalResult = this.cooldown.evaluateCluster(spike, this.config.detection);

        if (evalResult.shouldAlert && !options.dryRun) {
          const results = await this.dispatcher.dispatch(
            spike,
            evalResult.incidentRecord.id,
            evalResult.reason
          );
          const sentSuccess = results.some((r) => r.success);
          if (sentSuccess) {
            alertsDispatched++;
          }
        } else if (options.dryRun && evalResult.shouldAlert) {
          console.log(`[DryRun] Would alert on spike: ${spike.appName} v${spike.appVersion} (${spike.reviewCount} ${spike.category} reports)`);
        }
      }
    }

    // Resolve any stale incidents whose activity has stopped
    this.incidentStore.resolveStaleIncidents(this.config.detection.windowMinutes * 2);

    return {
      appsChecked: apps.length,
      newReviewsCount,
      triagedCount,
      spikesDetected,
      alertsDispatched,
      durationMs: Date.now() - startTime,
    };
  }

  public close(): void {
    this.dbManager.close();
  }
}
