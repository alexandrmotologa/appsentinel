import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SlackAlertChannel } from '../src/core/alerts/slack.js';
import { TelegramAlertChannel } from '../src/core/alerts/telegram.js';
import type { IncidentCluster } from '../src/types/incident.js';

describe('Alerts Layer', () => {
  const cluster: IncidentCluster = {
    id: 'cluster_test_alerts',
    appId: 'com.demo.app',
    appName: 'Demo App',
    platform: 'ios',
    category: 'CRASH',
    appVersion: '3.4.1',
    deviceModels: ['iPhone 15 Pro', 'iPhone 14'],
    osVersions: ['iOS 17.5'],
    reviewCount: 4,
    firstSeenAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    severity: 'P1_CRITICAL',
    rootCauseSummary: 'Instant app termination on checkout.',
    sampleReviews: [
      {
        id: 'r1',
        fingerprint: 'fp1',
        appId: 'com.demo.app',
        appName: 'Demo App',
        platform: 'ios',
        country: 'us',
        author: 'Alice',
        rating: 1,
        title: 'Crashes on pay',
        content: 'App closes immediately when pressing checkout.',
        version: '3.4.1',
        date: new Date().toISOString(),
        triagedAt: new Date().toISOString(),
        classifierProvider: 'local',
        triage: {
          category: 'CRASH',
          severity: 'P1_CRITICAL',
          deviceModel: 'iPhone 15 Pro',
          osVersion: 'iOS 17.5',
          extractedVersion: '3.4.1',
          rootCauseSummary: 'Crash on checkout.',
          actionableBugReport: true,
          sentimentScore: -0.9,
          keywords: ['crash', 'checkout'],
        },
      },
    ],
  };

  it('formats Slack Block Kit payload with header, context, and review quotes', () => {
    const slack = new SlackAlertChannel();
    const payload = slack.formatBlockKitPayload(cluster, 'new_incident') as { blocks: unknown[] };

    assert.ok(payload.blocks.length >= 4);
    const header = payload.blocks[0] as { type: string; text: { text: string } };
    assert.equal(header.type, 'header');
    assert.ok(header.text.text.includes('CRITICAL INCIDENT SPIKE'));
    assert.ok(header.text.text.includes('Demo App'));
  });

  it('formats Telegram HTML message with tags and review details', () => {
    const telegram = new TelegramAlertChannel();
    const msg = telegram.formatHtmlMessage(cluster, 'new_incident');

    assert.ok(msg.includes('<b>[P1_CRITICAL] Incident Alert: Demo App</b>'));
    assert.ok(msg.includes('<code>3.4.1</code>'));
    assert.ok(msg.includes('<code>CRASH</code>'));
    assert.ok(msg.includes('iPhone 15 Pro'));
    assert.ok(msg.includes('Instant app termination on checkout.'));
  });
});
