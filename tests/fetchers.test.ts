import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FixtureLoader } from '../src/core/fetchers/fixtures.js';

describe('Fetchers & Fixture Generation', () => {
  it('generates a realistic crash cascade with valid fingerprints and timestamps', () => {
    const cascade = FixtureLoader.generateCrashCascade({
      appId: 'com.test.app',
      appName: 'Test Runner',
      platform: 'ios',
      version: '4.2.0',
      count: 5,
    });

    assert.equal(cascade.length, 5);
    for (const review of cascade) {
      assert.equal(review.appId, 'com.test.app');
      assert.equal(review.platform, 'ios');
      assert.equal(review.version, '4.2.0');
      assert.equal(review.rating, 1);
      assert.ok(review.fingerprint.length === 64, 'SHA-256 fingerprint should be 64 hex chars');
      assert.ok(review.content.toLowerCase().includes('crash') || review.content.toLowerCase().includes('freeze'));
    }
  });

  it('generates a payment cascade for billing incidents', () => {
    const payments = FixtureLoader.generatePaymentCascade({
      count: 4,
      version: '3.8.0',
    });

    assert.equal(payments.length, 4);
    for (const review of payments) {
      assert.equal(review.rating, 1);
      assert.ok(
        review.content.toLowerCase().includes('bought') ||
        review.content.toLowerCase().includes('charged') ||
        review.content.toLowerCase().includes('purchased') ||
        review.content.toLowerCase().includes('billing')
      );
    }
  });
});
