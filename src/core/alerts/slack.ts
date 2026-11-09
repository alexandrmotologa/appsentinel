import type { DispatchResult } from '../../types/alert.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { SlackAlertConfig } from '../../types/config.js';
import type { AlertChannel } from './channel.js';

export class SlackAlertChannel implements AlertChannel {
  public readonly name = 'slack';
  public readonly isEnabled: boolean;
  private webhookUrl: string;

  constructor(config?: SlackAlertConfig) {
    this.isEnabled = Boolean(config?.enabled && config?.webhookUrl);
    this.webhookUrl = config?.webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
    if (config?.enabled && this.webhookUrl) {
      this.isEnabled = true;
    }
  }

  public async sendAlert(incident: IncidentCluster, reason: string = 'new_incident'): Promise<DispatchResult> {
    const startTime = Date.now();

    if (!this.isEnabled || !this.webhookUrl) {
      return {
        channel: this.name,
        success: false,
        error: 'Slack channel is disabled or webhookUrl is missing',
        durationMs: 0,
      };
    }

    const payload = this.formatBlockKitPayload(incident, reason);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack webhook responded with HTTP ${response.status}: ${text}`);
      }

      return {
        channel: this.name,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        channel: this.name,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }

  public formatBlockKitPayload(incident: IncidentCluster, reason: string): Record<string, unknown> {
    const isCritical = incident.severity === 'P1_CRITICAL';
    const badge = isCritical ? '🚨 CRITICAL INCIDENT SPIKE' : '⚠️ HIGH SEVERITY ALERT';
    const tag = reason === 'escalated' ? ' [ESCALATED]' : '';

    const devices = incident.deviceModels.length > 0 ? incident.deviceModels.slice(0, 3).join(', ') : 'Not specified';
    const osVersions = incident.osVersions.length > 0 ? incident.osVersions.slice(0, 3).join(', ') : 'Not specified';

    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${badge}: ${incident.appName}${tag}`,
          emoji: true,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Platform:* ${incident.platform.toUpperCase()}  |  *Version:* \`${incident.appVersion}\`  |  *Category:* \`${incident.category}\``,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Report Volume:*\n${incident.reviewCount} reports in window`,
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n\`${incident.severity}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Affected Devices:*\n${devices}`,
          },
          {
            type: 'mrkdwn',
            text: `*OS Versions:*\n${osVersions}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Root Cause Summary:*\n${incident.rootCauseSummary}`,
        },
      },
    ];

    if (incident.sampleReviews && incident.sampleReviews.length > 0) {
      const quotes = incident.sampleReviews
        .slice(0, 3)
        .map((r) => `> "${r.content.replace(/\n+/g, ' ').slice(0, 140)}" - _${r.author}_`)
        .join('\n');

      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Recent User Feedback:*\n${quotes}`,
          },
        }
      );
    }

    return { blocks };
  }
}
