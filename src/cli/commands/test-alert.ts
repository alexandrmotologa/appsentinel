import { SlackAlertChannel } from '../../core/alerts/slack.js';
import { TelegramAlertChannel } from '../../core/alerts/telegram.js';
import { GenericWebhookChannel } from '../../core/alerts/webhook.js';
import type { IncidentCluster } from '../../types/incident.js';
import { TerminalFormatters } from '../formatters.js';

export async function testAlertCommand(options: {
  channel: 'slack' | 'telegram' | 'webhook';
  webhook?: string;
  token?: string;
  chatId?: string;
  url?: string;
  secret?: string;
}): Promise<void> {
  const sampleIncident: IncidentCluster = {
    id: `test_cluster_${Date.now()}`,
    appId: 'com.example.testapp',
    appName: 'Test Mobile App',
    platform: 'ios',
    category: 'CRASH',
    appVersion: '4.2.0',
    deviceModels: ['iPhone 15 Pro', 'iPhone 14 Pro Max'],
    osVersions: ['iOS 17.5'],
    reviewCount: 4,
    firstSeenAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    severity: 'P1_CRITICAL',
    rootCauseSummary: 'Synthetic test incident alert dispatched by AppSentinel CLI.',
    sampleReviews: [
      {
        id: 'rev_sample_1',
        fingerprint: 'fp_1',
        appId: 'com.example.testapp',
        appName: 'Test Mobile App',
        platform: 'ios',
        country: 'us',
        author: 'QA_Lead',
        rating: 1,
        title: 'App crashed on startup',
        content: 'Instant termination upon opening on iPhone 15 Pro.',
        version: '4.2.0',
        date: new Date().toISOString(),
        triagedAt: new Date().toISOString(),
        classifierProvider: 'test',
        triage: {
          category: 'CRASH',
          severity: 'P1_CRITICAL',
          deviceModel: 'iPhone 15 Pro',
          osVersion: 'iOS 17.5',
          extractedVersion: '4.2.0',
          rootCauseSummary: 'Instant crash on startup.',
          actionableBugReport: true,
          sentimentScore: -0.9,
          keywords: ['crash', 'startup'],
        },
      },
    ],
  };

  TerminalFormatters.info(`Sending test alert to channel '${options.channel}'...`);

  if (options.channel === 'slack') {
    const webhookUrl = options.webhook || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      TerminalFormatters.error('Slack webhook URL missing. Pass --webhook <url> or set SLACK_WEBHOOK_URL.');
      return;
    }
    const channel = new SlackAlertChannel({ enabled: true, webhookUrl });
    const result = await channel.sendAlert(sampleIncident, 'new_incident');
    if (result.success) {
      TerminalFormatters.success(`Slack alert sent successfully in ${result.durationMs}ms.`);
    } else {
      TerminalFormatters.error(`Slack alert failed: ${result.error}`);
    }
  } else if (options.channel === 'telegram') {
    const botToken = options.token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      TerminalFormatters.error('Telegram botToken or chatId missing. Pass --token and --chat-id or set environment variables.');
      return;
    }
    const channel = new TelegramAlertChannel({ enabled: true, botToken, chatId });
    const result = await channel.sendAlert(sampleIncident, 'new_incident');
    if (result.success) {
      TerminalFormatters.success(`Telegram alert sent successfully in ${result.durationMs}ms.`);
    } else {
      TerminalFormatters.error(`Telegram alert failed: ${result.error}`);
    }
  } else if (options.channel === 'webhook') {
    const url = options.url || process.env.APPSENTINEL_WEBHOOK_URL;
    if (!url) {
      TerminalFormatters.error('Webhook URL missing. Pass --url <url> or set APPSENTINEL_WEBHOOK_URL.');
      return;
    }
    const channel = new GenericWebhookChannel({ enabled: true, url, secret: options.secret });
    const result = await channel.sendAlert(sampleIncident, 'new_incident');
    if (result.success) {
      TerminalFormatters.success(`Generic webhook alert sent successfully in ${result.durationMs}ms.`);
    } else {
      TerminalFormatters.error(`Generic webhook alert failed: ${result.error}`);
    }
  } else {
    TerminalFormatters.error(`Unknown channel '${options.channel}'. Use 'slack', 'telegram', or 'webhook'.`);
  }
}
