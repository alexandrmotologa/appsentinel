import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../src/core/storage/database.js';
import { ReviewStore } from '../src/core/storage/review-store.js';
import { IncidentStore } from '../src/core/storage/incident-store.js';
import { SpikeDetector } from '../src/core/detector/anomaly.js';
import { CooldownManager } from '../src/core/detector/cooldown.js';
import { FixtureLoader } from '../src/core/fetchers/fixtures.js';
import { LocalHeuristicClassifier } from '../src/core/classifier/heuristics.js';
import type { DetectionConfig, MonitoredApp } from '../src/types/config.js';

describe('Detector Layer', () => {
  let dbManager: DatabaseManager;
  let reviewStore: ReviewStore;
  let incidentStore: IncidentStore;
  let detector: SpikeDetector;
  let cooldown: CooldownManager;
  const classifier = new LocalHeuristicClassifier();

  const sampleApp: MonitoredApp = {
    id: 'battle-quest-ios',
    platform: 'ios',
    appId: 'com.superstudio.battlequest',
    name: 'Battle Quest',
    countries: ['us'],
    spikeThreshold: 3,
    windowMinutes: 60,
  };

  const detectionConfig: DetectionConfig = {
    windowMinutes: 60,
    spikeThreshold: 3,
    cooldownMinutes: 60,
    minSeverity: 'P1_CRITICAL',
  };

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
    reviewStore = new ReviewStore(dbManager);
    incidentStore = new IncidentStore(dbManager);
    detector = new SpikeDetector(reviewStore);
    cooldown = new CooldownManager(incidentStore);
  });

  it('detects a spike when 5 crash reviews arrive within the sliding window', async () => {
    const rawCascade = FixtureLoader.generateCrashCascade({
      appId: sampleApp.appId,
      appName: sampleApp.name,
      platform: sampleApp.platform,
      version: '4.2.0',
      count: 5,
    });

    for (const raw of rawCascade) {
      const insert = reviewStore.insertReview(raw);
      const triage = await classifier.triage(raw);
      reviewStore.saveTriagedReview(
        {
          ...raw,
          triage,
          triagedAt: new Date().toISOString(),
          classifierProvider: 'local',
        },
        insert.id
      );
    }

    const clusters = detector.detectSpikes(sampleApp, detectionConfig);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].appVersion, '4.2.0');
    assert.equal(clusters[0].category, 'CRASH');
    assert.equal(clusters[0].reviewCount, 5);
    assert.equal(clusters[0].severity, 'P1_CRITICAL');
  });

  it('suppresses alerts under active cooldown unless escalated', () => {
    const cluster = {
      id: 'cluster_test_cooldown',
      appId: sampleApp.appId,
      appName: sampleApp.name,
      platform: sampleApp.platform,
      category: 'CRASH' as const,
      appVersion: '4.2.0',
      deviceModels: ['iPhone 15 Pro'],
      osVersions: ['iOS 17.4'],
      reviewCount: 3,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      severity: 'P1_CRITICAL' as const,
      rootCauseSummary: 'Crash spike',
      sampleReviews: [],
    };

    // First evaluation: new incident
    const eval1 = cooldown.evaluateCluster(cluster, detectionConfig);
    assert.equal(eval1.shouldAlert, true);
    assert.equal(eval1.reason, 'new_incident');

    // Simulate alert sent
    incidentStore.recordAlertDispatched(eval1.incidentRecord.id, 'slack', 'sent', {});

    // Second evaluation right away: should be suppressed
    const eval2 = cooldown.evaluateCluster({ ...cluster, reviewCount: 4 }, detectionConfig);
    assert.equal(eval2.shouldAlert, false);
    assert.equal(eval2.reason, 'cooldown_suppressed');

    // Third evaluation with significant escalation (+4 reviews): should alert
    const eval3 = cooldown.evaluateCluster({ ...cluster, reviewCount: 8 }, detectionConfig);
    assert.equal(eval3.shouldAlert, true);
    assert.equal(eval3.reason, 'escalated');
  });
});
