import type { DispatchResult } from '../../types/alert.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { TeamsAlertConfig } from '../../types/config.js';
import type { AlertChannel } from './channel.js';

export class TeamsAlertChannel implements AlertChannel {
  public readonly name = 'teams';
  public readonly isEnabled: boolean;
  private webhookUrl: string;

  constructor(config?: TeamsAlertConfig) {
    this.webhookUrl = config?.webhookUrl || process.env.TEAMS_WEBHOOK_URL || '';
    this.isEnabled = Boolean(config?.enabled && this.webhookUrl);
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
        error: 'Teams channel is disabled or webhookUrl is missing',
        durationMs: 0,
      };
    }

    const payload = this.formatTeamsPayload(incident, reason);
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
        throw new Error(`Teams webhook responded with HTTP ${response.status}: ${text}`);
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

  public formatTeamsPayload(incident: IncidentCluster, reason: string): Record<string, unknown> {
    const isCritical = incident.severity === 'P1_CRITICAL';
    const themeColor = isCritical ? 'FF0000' : 'FFA500';
    const tag = reason === 'escalated' ? ' [ESCALATED]' : '';

    const devices = incident.deviceModels.length > 0 ? incident.deviceModels.slice(0, 3).join(', ') : 'Not specified';
    const osVersions = incident.osVersions.length > 0 ? incident.osVersions.slice(0, 3).join(', ') : 'Not specified';

    const facts: Array<{ name: string; value: string }> = [
      { name: 'App / Platform', value: `${incident.appName} (${incident.platform.toUpperCase()})` },
      { name: 'Version', value: incident.appVersion },
      { name: 'Category', value: incident.category },
      { name: 'Subsystem', value: incident.subsystem || 'UNKNOWN' },
      { name: 'Volume', value: `${incident.reviewCount} reports in window` },
      { name: 'Devices', value: `${devices} (${osVersions})` },
    ];

    if (incident.suggestedMitigation) {
      facts.push({ name: 'Suggested Mitigation', value: incident.suggestedMitigation });
    }

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `AppSentinel Incident: ${incident.appName}`,
      themeColor,
      title: `🚨 [${incident.severity}] Incident Alert: ${incident.appName}${tag}`,
      sections: [
        {
          activityTitle: incident.rootCauseSummary,
          facts,
          markdown: true,
        },
      ],
    };
  }
}
