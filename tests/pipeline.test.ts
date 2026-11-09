import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../src/core/storage/database.js';
import { ReviewStore } from '../src/core/storage/review-store.js';
import { IncidentStore } from '../src/core/storage/incident-store.js';
import { ClassifierFactory } from '../src/core/classifier/factory.js';
import { SpikeDetector } from '../src/core/detector/anomaly.js';
import { CooldownManager } from '../src/core/detector/cooldown.js';
import { FixtureLoader } from '../src/core/fetchers/fixtures.js';
import type { DetectionConfig, MonitoredApp } from '../src/types/config.js';

describe('End-to-End Monitoring Pipeline', () => {
  it('runs complete lifecycle: ingest -> dedupe -> triage -> spike -> cooldown', async () => {
    const dbManager = new DatabaseManager(':memory:');
    const reviewStore = new ReviewStore(dbManager);
    const incidentStore = new IncidentStore(dbManager);
    const classifier = ClassifierFactory.create({ provider: 'local' });
    const detector = new SpikeDetector(reviewStore);
    const cooldown = new CooldownManager(incidentStore);

    const app: MonitoredApp = {
      id: 'apex-racing-ios',
      name: 'Apex Racing',
      platform: 'ios',
      appId: 'com.apex.racing',
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

    // 1. Generate a 5-review crash spike
    const rawCascade = FixtureLoader.generateCrashCascade({
      appId: app.appId,
      appName: app.name,
      platform: app.platform,
      version: '3.0.1',
      count: 5,
    });

    // 2. Ingest and triage
    for (const raw of rawCascade) {
      const insert = reviewStore.insertReview(raw);
      assert.equal(insert.inserted, true);

      const triage = await classifier.triage(raw);
      reviewStore.saveTriagedReview(
        {
          ...raw,
          fingerprint: insert.fingerprint,
          triage,
          triagedAt: new Date().toISOString(),
          classifierProvider: classifier.name,
        },
        insert.id
      );
    }

    // 3. Spike detection
    const spikes = detector.detectSpikes(app, detectionConfig);
    assert.equal(spikes.length, 1);
    const spike = spikes[0];
    assert.equal(spike.category, 'CRASH');
    assert.equal(spike.severity, 'P1_CRITICAL');
    assert.equal(spike.appVersion, '3.0.1');
    assert.equal(spike.reviewCount, 5);

    // 4. Cooldown evaluation
    const evalResult = cooldown.evaluateCluster(spike, detectionConfig);
    assert.equal(evalResult.shouldAlert, true);
    assert.equal(evalResult.reason, 'new_incident');

    // Record mock alert dispatched
    incidentStore.recordAlertDispatched(evalResult.incidentRecord.id, 'slack', 'sent', {});

    // 5. Subsequent run should suppress alert
    const evalSecond = cooldown.evaluateCluster(spike, detectionConfig);
    assert.equal(evalSecond.shouldAlert, false);
    assert.equal(evalSecond.reason, 'cooldown_suppressed');

    dbManager.close();
  });
});
