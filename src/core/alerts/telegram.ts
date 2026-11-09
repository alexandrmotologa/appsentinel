import type { DispatchResult } from '../../types/alert.js';
import type { IncidentCluster } from '../../types/incident.js';
import type { TelegramAlertConfig } from '../../types/config.js';
import type { AlertChannel } from './channel.js';

export class TelegramAlertChannel implements AlertChannel {
  public readonly name = 'telegram';
  public readonly isEnabled: boolean;
  private botToken: string;
  private chatId: string;

  constructor(config?: TelegramAlertConfig) {
    this.botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = config?.chatId || process.env.TELEGRAM_CHAT_ID || '';
    this.isEnabled = Boolean(config?.enabled && this.botToken && this.chatId);
    if (config?.enabled && this.botToken && this.chatId) {
      this.isEnabled = true;
    }
  }

  public async sendAlert(incident: IncidentCluster, reason: string = 'new_incident'): Promise<DispatchResult> {
    const startTime = Date.now();

    if (!this.isEnabled || !this.botToken || !this.chatId) {
      return {
        channel: this.name,
        success: false,
        error: 'Telegram channel is disabled or missing botToken/chatId',
        durationMs: 0,
      };
    }

    const htmlMessage = this.formatHtmlMessage(incident, reason);
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: htmlMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API responded with HTTP ${response.status}: ${errorText}`);
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

  public formatHtmlMessage(incident: IncidentCluster, reason: string): string {
    const isCritical = incident.severity === 'P1_CRITICAL';
    const icon = isCritical ? '🚨' : '⚠️';
    const tag = reason === 'escalated' ? ' <b>[ESCALATED]</b>' : '';

    const escape = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const devices =
      incident.deviceModels.length > 0
        ? incident.deviceModels.slice(0, 3).map(escape).join(', ')
        : 'Various devices';

    const osVersions =
      incident.osVersions.length > 0
        ? incident.osVersions.slice(0, 3).map(escape).join(', ')
        : 'Unknown';

    let msg = `${icon} <b>[${incident.severity}] Incident Alert: ${escape(incident.appName)}</b>${tag}\n\n`;
    msg += `📱 <b>Platform:</b> ${incident.platform.toUpperCase()}\n`;
    msg += `🏷️ <b>Version:</b> <code>${escape(incident.appVersion)}</code>\n`;
    msg += `📂 <b>Category:</b> <code>${escape(incident.category)}</code>\n`;
    msg += `📊 <b>Volume:</b> <b>${incident.reviewCount}</b> reports in rolling window\n`;
    msg += `💻 <b>Devices:</b> ${devices}\n`;
    msg += `⚙️ <b>OS:</b> ${osVersions}\n\n`;
    msg += `📝 <b>Root Cause:</b>\n${escape(incident.rootCauseSummary)}\n`;

    if (incident.sampleReviews && incident.sampleReviews.length > 0) {
      msg += `\n💬 <b>User Feedback:</b>\n`;
      for (const r of incident.sampleReviews.slice(0, 2)) {
        const snippet = r.content.replace(/\s+/g, ' ').slice(0, 120);
        msg += `• <i>"${escape(snippet)}"</i> (⭐${r.rating})\n`;
      }
    }

    return msg;
  }
}
