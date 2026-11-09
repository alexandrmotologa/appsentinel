import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LocalHeuristicClassifier } from '../src/core/classifier/heuristics.js';
import { ClassifierFactory } from '../src/core/classifier/factory.js';
import type { RawReview } from '../src/types/review.js';

describe('Classifier Layer', () => {
  const classifier = new LocalHeuristicClassifier();

  it('correctly classifies a crash review with device and OS context', async () => {
    const review: RawReview = {
      id: 'rev_crash_test',
      fingerprint: 'fp_1',
      appId: 'com.game.studio',
      appName: 'Studio Game',
      platform: 'ios',
      country: 'us',
      author: 'Gamer99',
      rating: 1,
      title: 'Crashes on launch',
      content: 'Since update v4.2.0, app crashes immediately on my iPhone 15 Pro Max running iOS 17.4.',
      version: '4.2.0',
      date: new Date().toISOString(),
    };

    const result = await classifier.triage(review);

    assert.equal(result.category, 'CRASH');
    assert.equal(result.severity, 'P1_CRITICAL');
    assert.ok(result.deviceModel?.includes('iPhone 15 Pro'));
    assert.equal(result.osVersion, 'iOS 17.4');
    assert.equal(result.actionableBugReport, true);
    assert.ok(result.sentimentScore < 0);
  });

  it('correctly classifies an in-app billing failure on Samsung Galaxy', async () => {
    const review: RawReview = {
      id: 'rev_pay_test',
      fingerprint: 'fp_2',
      appId: 'com.store.app',
      appName: 'Store App',
      platform: 'android',
      country: 'us',
      author: 'Shopper',
      rating: 1,
      title: 'Charged but coins not received',
      content: 'I purchased the $19.99 coin pack, Google Play charged my card, but the app gave an error. Samsung Galaxy S23 Ultra.',
      version: '3.1.0',
      date: new Date().toISOString(),
    };

    const result = await classifier.triage(review);

    assert.equal(result.category, 'IN_APP_PURCHASE_FAIL');
    assert.equal(result.severity, 'P1_CRITICAL');
    assert.ok(result.deviceModel?.includes('S23'));
    assert.equal(result.actionableBugReport, true);
  });

  it('classifies account login failures as P2_HIGH', async () => {
    const review: RawReview = {
      id: 'rev_login_test',
      fingerprint: 'fp_3',
      appId: 'com.social.app',
      appName: 'Social App',
      platform: 'android',
      country: 'us',
      author: 'Alex',
      rating: 1,
      title: 'Cant login',
      content: 'Password verification fails every time. Locked out of my account since yesterday on Pixel 8 Pro.',
      version: '1.9.0',
      date: new Date().toISOString(),
    };

    const result = await classifier.triage(review);

    assert.equal(result.category, 'ACCOUNT_LOGIN');
    assert.equal(result.severity, 'P2_HIGH');
    assert.ok(result.deviceModel?.includes('Pixel 8 Pro'));
  });

  it('factory defaults to local classifier when no API keys are present', () => {
    const instance = ClassifierFactory.create({ provider: 'anthropic' });
    assert.ok(instance, 'Should return fallback/local instance gracefully');
  });
});
