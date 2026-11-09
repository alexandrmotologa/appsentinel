import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../src/core/storage/database.js';
import { ReviewStore } from '../src/core/storage/review-store.js';
import { IncidentStore } from '../src/core/storage/incident-store.js';

describe('Storage Layer', () => {
  let dbManager: DatabaseManager;
  let reviewStore: ReviewStore;
  let incidentStore: IncidentStore;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
    reviewStore = new ReviewStore(dbManager);
    incidentStore = new IncidentStore(dbManager);
  });

  it('inserts reviews and detects duplicates by fingerprint', () => {
    const raw = {
      id: 'rev_123',
      appId: 'com.example.app',
      appName: 'Example App',
      platform: 'ios' as const,
      country: 'us',
      author: 'Jane Doe',
      rating: 1,
      title: 'Crash on launch',
      content: 'App crashes immediately on iOS 17.5',
      version: '1.2.3',
      date: new Date().toISOString(),
    };

    const first = reviewStore.insertReview(raw);
    assert.equal(first.inserted, true);
    assert.ok(first.id > 0);
    assert.ok(first.fingerprint.length > 0);

    // Duplicate insert should be detected and skipped
    const second = reviewStore.insertReview(raw);
    assert.equal(second.inserted, false);
    assert.equal(second.id, first.id);
  });

  it('filters positive reviews by marking them as skipped_positive', () => {
    const positive = {
      id: 'rev_pos',
      appId: 'com.example.app',
      appName: 'Example App',
      platform: 'ios' as const,
      country: 'us',
      author: 'Happy User',
      rating: 5,
      title: 'Love this app',
      content: 'Works amazingly well!',
      version: '1.2.3',
      date: new Date().toISOString(),
    };

    const res = reviewStore.insertReview(positive);
    assert.equal(res.inserted, true);

    const pending = reviewStore.getPendingTriageReviews();
    assert.equal(pending.length, 0, 'Positive reviews must not enter pending triage queue');
  });

  it('saves triaged reviews and retrieves them in sliding window', () => {
    const raw = {
      id: 'rev_crash_1',
      appId: 'com.example.app',
      appName: 'Example App',
      platform: 'android' as const,
      country: 'us',
      author: 'Bob',
      rating: 1,
      title: 'Broken after update',
      content: 'Galaxy S23 crashes on login',
      version: '2.0.0',
      date: new Date().toISOString(),
    };

    const insertResult = reviewStore.insertReview(raw);
    const pending = reviewStore.getPendingTriageReviews();
    assert.equal(pending.length, 1);

    reviewStore.saveTriagedReview(
      {
        ...raw,
        fingerprint: insertResult.fingerprint,
        triagedAt: new Date().toISOString(),
        classifierProvider: 'local',
        triage: {
          category: 'CRASH',
          severity: 'P1_CRITICAL',
          deviceModel: 'Samsung Galaxy S23',
          osVersion: 'Android 14',
          extractedVersion: '2.0.0',
          rootCauseSummary: 'Immediate crash on account login.',
          actionableBugReport: true,
          sentimentScore: -0.9,
          keywords: ['crash', 'login', 's23'],
        },
      },
      pending[0].dbId
    );

    const afterTriage = reviewStore.getPendingTriageReviews();
    assert.equal(afterTriage.length, 0);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const windowReviews = reviewStore.getTriagedReviewsInWindow('com.example.app', oneHourAgo);
    assert.equal(windowReviews.length, 1);
    assert.equal(windowReviews[0].triage.category, 'CRASH');
    assert.equal(windowReviews[0].triage.deviceModel, 'Samsung Galaxy S23');
  });

  it('manages incident lifecycle and alert records', () => {
    const cluster = {
      id: 'fp_crash_v2',
      appId: 'com.example.app',
      appName: 'Example App',
      platform: 'ios' as const,
      category: 'CRASH' as const,
      appVersion: '2.0.0',
      deviceModels: ['iPhone 15 Pro'],
      osVersions: ['iOS 17.4'],
      reviewCount: 3,
      firstSeenAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      severity: 'P1_CRITICAL' as const,
      rootCauseSummary: 'Crash spike detected on v2.0.0',
      sampleReviews: [],
    };

    const incident = incidentStore.upsertIncident(cluster, 'active');
    assert.ok(incident.id.startsWith('inc_'));
    assert.equal(incident.reviewCount, 3);
    assert.equal(incident.status, 'active');

    incidentStore.recordAlertDispatched(incident.id, 'slack', 'sent', { text: 'alert' });

    const activeList = incidentStore.listIncidents();
    assert.equal(activeList.length, 1);
    assert.equal(activeList[0].status, 'cooldown');
  });
});
