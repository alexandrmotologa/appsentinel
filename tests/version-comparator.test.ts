import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../src/core/storage/database.js';
import { ReviewStore } from '../src/core/storage/review-store.js';
import { VersionComparator } from '../src/core/reporting/version-comparator.js';
import { LocalHeuristicClassifier } from '../src/core/classifier/heuristics.js';

describe('Version Comparator & Rollout Decision Engine', () => {
  it('recommends PAUSE_ROLLOUT when crash rate surges on new release', async () => {
    const db = new DatabaseManager(':memory:');
    const store = new ReviewStore(db);
    const classifier = new LocalHeuristicClassifier();
    const comparator = new VersionComparator(db);
    const appId = 'com.game.test';

    // Baseline v1.0.0: 10 reviews, mostly 5 stars, 0 crashes
    for (let i = 0; i < 10; i++) {
      store.insertReview({
        id: `v1_${i}`,
        appId,
        appName: 'Test Game',
        platform: 'ios',
        country: 'us',
        author: `User1_${i}`,
        rating: 5,
        title: 'Great',
        content: 'Works great',
        version: '1.0.0',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Release v1.1.0: 5 reviews, 4 crashes
    for (let i = 0; i < 4; i++) {
      const raw = {
        id: `v2_crash_${i}`,
        appId,
        appName: 'Test Game',
        platform: 'ios',
        country: 'us',
        author: `User2_${i}`,
        rating: 1,
        title: 'Crash on launch',
        content: 'App crashes immediately on launch on iPhone 15 Pro.',
        version: '1.1.0',
        date: new Date().toISOString(),
      };
      const insert = store.insertReview(raw);
      const triage = await classifier.triage(raw);
      store.saveTriagedReview(
        { ...raw, fingerprint: insert.fingerprint, triage, triagedAt: new Date().toISOString(), classifierProvider: 'test' },
        insert.id
      );
    }

    const comparison = comparator.compare(appId, '1.0.0', '1.1.0');
    assert.equal(comparison.recommendation, 'PAUSE_ROLLOUT');
    assert.ok(comparison.reasons.some((r) => r.includes('Crash rate surged')));

    db.close();
  });
});
