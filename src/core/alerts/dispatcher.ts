import type { DispatchResult } from '../../types/alert.js';
import type { AlertsConfig } from '../../types/config.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { IncidentStore } from '../storage/incident-store.js';
import type { AlertChannel } from './channel.js';
import { SlackAlertChannel } from './slack.js';
import { TelegramAlertChannel } from './telegram.js';
import { GenericWebhookChannel } from './webhook.js';

export class AlertDispatcher {
  private channels: AlertChannel[] = [];
  private incidentStore?: IncidentStore;

  constructor(config?: AlertsConfig, incidentStore?: IncidentStore) {
    this.incidentStore = incidentStore;

    if (config?.slack) {
      this.channels.push(new SlackAlertChannel(config.slack));
    }
    if (config?.telegram) {
      this.channels.push(new TelegramAlertChannel(config.telegram));
    }
    if (config?.webhook) {
      this.channels.push(new GenericWebhookChannel(config.webhook));
    }
  }

  public getEnabledChannels(): string[] {
    return this.channels.filter((c) => c.isEnabled).map((c) => c.name);
  }

  public async dispatch(
    incident: IncidentCluster,
    incidentDbId: string,
    reason: string = 'new_incident'
  ): Promise<DispatchResult[]> {
    const enabledChannels = this.channels.filter((c) => c.isEnabled);

    if (enabledChannels.length === 0) {
      // No active channels, log to console
      console.log(
        `[AlertDispatcher] 📢 Incident spike detected for ${incident.appName} (${incident.reviewCount} ${incident.category} reports), but no outbound alert channels are enabled.`
      );
      return [];
    }

    const promises = enabledChannels.map(async (channel) => {
      try {
        const result = await channel.sendAlert(incident, reason);

        if (this.incidentStore) {
          this.incidentStore.recordAlertDispatched(
            incidentDbId,
            channel.name,
            result.success ? 'sent' : 'failed',
            { incidentId: incident.id, reason },
            result.error
          );
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (this.incidentStore) {
          this.incidentStore.recordAlertDispatched(
            incidentDbId,
            channel.name,
            'failed',
            { incidentId: incident.id },
            errorMsg
          );
        }
        return {
          channel: channel.name,
          success: false,
          error: errorMsg,
          durationMs: 0,
        };
      }
    });

    return await Promise.all(promises);
  }
}
