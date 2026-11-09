import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeveloperReplyGenerator } from '../src/core/support/reply-generator.js';
import type { IncidentCluster } from '../src/types/incident.js';

describe('Developer Reply Generator', () => {
  const cluster: IncidentCluster = {
    id: 'test_rep',
    appId: 'com.test',
    appName: 'TestApp',
    platform: 'ios',
    category: 'CRASH',
    appVersion: '4.2.0',
    deviceModels: ['iPhone 15 Pro'],
    osVersions: ['iOS 17.5'],
    reviewCount: 3,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    severity: 'P1_CRITICAL',
    rootCauseSummary: 'Instant crash on startup.',
    sampleReviews: [],
  };

  it('generates English developer reply referencing device model and version', () => {
    const text = DeveloperReplyGenerator.generateReply(cluster, {
      language: 'en',
      supportEmail: 'help@test.com',
    });
    assert.ok(text.includes('iPhone 15 Pro'));
    assert.ok(text.includes('4.2.0'));
    assert.ok(text.includes('help@test.com'));
  });

  it('generates German developer reply referencing device model', () => {
    const text = DeveloperReplyGenerator.generateReply(cluster, {
      language: 'de',
    });
    assert.ok(text.includes('iPhone 15 Pro'));
    assert.ok(text.includes('4.2.0'));
    assert.ok(text.includes('Entwicklerteam'));
  });
});
