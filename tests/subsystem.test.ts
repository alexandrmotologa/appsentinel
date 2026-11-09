import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LocalHeuristicClassifier } from '../src/core/classifier/heuristics.js';
import type { RawReview } from '../src/types/review.js';

describe('Subsystem Tagging & Engineering Mitigations', () => {
  const classifier = new LocalHeuristicClassifier();

  it('tags StoreKit / Billing subsystem and gives SKU verification mitigation', async () => {
    const review: RawReview = {
      id: 'rev_sub_1',
      fingerprint: 'fp_1',
      appId: 'com.store.test',
      appName: 'Store Test',
      platform: 'ios',
      country: 'us',
      author: 'Buyer',
      rating: 1,
      title: 'Charged for coins but error received',
      content: 'StoreKit transaction failed after debiting money. Google Play billing receipt invalid.',
      version: '2.1.0',
      date: new Date().toISOString(),
    };

    const res = await classifier.triage(review);
    assert.equal(res.subsystem, 'STOREKIT_BILLING');
    assert.ok(res.suggestedMitigation?.includes('StoreKit 2 / Google Play Billing'));
  });

  it('tags App Lifecycle for startup crash and suggests AppDelegate audit', async () => {
    const review: RawReview = {
      id: 'rev_sub_2',
      fingerprint: 'fp_2',
      appId: 'com.app.test',
      appName: 'App Test',
      platform: 'ios',
      country: 'us',
      author: 'Tester',
      rating: 1,
      title: 'Instant crash on startup',
      content: 'App crashes immediately on splash screen after today update to 4.2.0.',
      version: '4.2.0',
      date: new Date().toISOString(),
    };

    const res = await classifier.triage(review);
    assert.equal(res.subsystem, 'APP_LIFECYCLE');
    assert.ok(res.suggestedMitigation?.includes('AppDelegate / Application.onCreate'));
  });
});
