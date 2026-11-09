import type { DispatchResult } from '../../types/alert.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { WebhookAlertConfig } from '../../types/config.js';
import type { AlertChannel } from './channel.js';

export class GenericWebhookChannel implements AlertChannel {
  public readonly name = 'webhook';
  public readonly isEnabled: boolean;
  private url: string;
  private secret?: string;

  constructor(config?: WebhookAlertConfig) {
    this.url = config?.url || process.env.APPSENTINEL_WEBHOOK_URL || '';
    this.secret = config?.secret || process.env.APPSENTINEL_WEBHOOK_SECRET;
    this.isEnabled = Boolean(config?.enabled && this.url);
    if (config?.enabled && this.url) {
      this.isEnabled = true;
    }
  }

  public async sendAlert(incident: IncidentCluster, reason: string = 'new_incident'): Promise<DispatchResult> {
    const startTime = Date.now();

    if (!this.isEnabled || !this.url) {
      return {
        channel: this.name,
        success: false,
        error: 'Generic webhook is disabled or missing url',
        durationMs: 0,
      };
    }

    const payload = {
      event: reason === 'escalated' ? 'incident.escalated' : 'incident.spike_detected',
      reason,
      timestamp: new Date().toISOString(),
      incident: {
        id: incident.id,
        appId: incident.appId,
        appName: incident.appName,
        platform: incident.platform,
        category: incident.category,
        appVersion: incident.appVersion,
        severity: incident.severity,
        reviewCount: incident.reviewCount,
        deviceModels: incident.deviceModels,
        osVersions: incident.osVersions,
        firstSeenAt: incident.firstSeenAt,
        lastSeenAt: incident.lastSeenAt,
        rootCauseSummary: incident.rootCauseSummary,
        sampleReviews: incident.sampleReviews.map((r) => ({
          id: r.id,
          author: r.author,
          rating: r.rating,
          content: r.content,
          date: r.date,
          version: r.version,
        })),
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AppSentinel-Alerter/1.0',
    };

    if (this.secret) {
      headers['Authorization'] = `Bearer ${this.secret}`;
      headers['X-AppSentinel-Secret'] = this.secret;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Webhook returned HTTP ${response.status}: ${text}`);
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
}
