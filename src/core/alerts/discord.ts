import type { DispatchResult } from '../../types/alert.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { DiscordAlertConfig } from '../../types/config.js';
import type { AlertChannel } from './channel.js';

export class DiscordAlertChannel implements AlertChannel {
  public readonly name = 'discord';
  public readonly isEnabled: boolean;
  private webhookUrl: string;

  constructor(config?: DiscordAlertConfig) {
    this.webhookUrl = config?.webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
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
        error: 'Discord channel is disabled or webhookUrl is missing',
        durationMs: 0,
      };
    }

    const payload = this.formatDiscordPayload(incident, reason);
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
        throw new Error(`Discord webhook responded with HTTP ${response.status}: ${text}`);
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

  public formatDiscordPayload(incident: IncidentCluster, reason: string): Record<string, unknown> {
    const isCritical = incident.severity === 'P1_CRITICAL';
    const color = isCritical ? 0xed4245 : 0xfee75c; // Red or Yellow
    const tag = reason === 'escalated' ? ' [ESCALATED]' : '';

    const devices = incident.deviceModels.length > 0 ? incident.deviceModels.slice(0, 3).join(', ') : 'Not specified';
    const osVersions = incident.osVersions.length > 0 ? incident.osVersions.slice(0, 3).join(', ') : 'Not specified';

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'App / Platform', value: `${incident.appName} (${incident.platform.toUpperCase()})`, inline: true },
      { name: 'Version', value: `\`v${incident.appVersion}\``, inline: true },
      { name: 'Severity / Category', value: `\`${incident.severity}\` | \`${incident.category}\``, inline: true },
      { name: 'Reports Volume', value: `**${incident.reviewCount}** reports in rolling window`, inline: true },
      { name: 'Subsystem Area', value: `\`${incident.subsystem || 'UNKNOWN'}\``, inline: true },
      { name: 'Affected Hardware', value: `${devices} (${osVersions})`, inline: false },
    ];

    if (incident.suggestedMitigation) {
      fields.push({
        name: 'Suggested Action & Mitigation',
        value: `🛠️ ${incident.suggestedMitigation}`,
        inline: false,
      });
    }

    if (incident.sampleReviews && incident.sampleReviews.length > 0) {
      const quotes = incident.sampleReviews
        .slice(0, 2)
        .map((r) => `> "${r.content.replace(/\s+/g, ' ').slice(0, 120)}" — *${r.author} (⭐${r.rating})*`)
        .join('\n');
      fields.push({
        name: 'User Review Quotes',
        value: quotes,
        inline: false,
      });
    }

    return {
      username: 'AppSentinel',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/900/900782.png',
      embeds: [
        {
          title: `🚨 ${incident.severity} Incident Alert: ${incident.appName}${tag}`,
          description: incident.rootCauseSummary,
          color,
          fields,
          footer: { text: `AppSentinel Incident Monitor • ${incident.id}` },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}
