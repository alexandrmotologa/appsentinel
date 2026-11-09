import type { DatabaseManager } from '../storage/database.js';
import type { IncidentStore } from '../storage/incident-store.js';

export interface ReportOptions {
  days?: number;
  format?: 'markdown' | 'json' | 'html';
  appName?: string;
}

export class ReportGenerator {
  private incidentStore: IncidentStore;
  private dbManager: DatabaseManager;

  constructor(incidentStore: IncidentStore, dbManager: DatabaseManager) {
    this.incidentStore = incidentStore;
    this.dbManager = dbManager;
  }

  public generateReport(options: ReportOptions = {}): string {
    const days = options.days || 7;
    const format = options.format || 'markdown';

    const incidents = this.incidentStore.listIncidents({ days, limit: 100 });
    const stats = this.dbManager.getStats();

    if (format === 'json') {
      return JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          timeWindowDays: days,
          overview: stats,
          incidents: incidents.map((inc) => ({
            ...inc,
            deviceModels: JSON.parse(inc.deviceModelsJson || '[]'),
            osVersions: JSON.parse(inc.osVersionsJson || '[]'),
            sampleReviews: JSON.parse(inc.sampleReviewsJson || '[]'),
          })),
        },
        null,
        2
      );
    }

    if (format === 'html') {
      return this.generateHtmlReport(days, stats, incidents);
    }

    return this.generateMarkdownReport(days, stats, incidents);
  }

  private generateMarkdownReport(
    days: number,
    stats: ReturnType<DatabaseManager['getStats']>,
    incidents: ReturnType<IncidentStore['listIncidents']>
  ): string {
    let md = `# AppSentinel Incident Digest (Past ${days} Days)\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;

    md += `## Summary Metrics\n\n`;
    md += `* Total Reviews Ingested: ${stats.totalReviews}\n`;
    md += `* Negative Reviews Triaged: ${stats.triagedReviews}\n`;
    md += `* Incident Spikes Recorded: ${stats.totalIncidents}\n`;
    md += `* Active Ongoing Incidents: ${stats.activeIncidents}\n`;
    md += `* Outbound Alerts Dispatched: ${stats.alertsDispatched}\n\n`;

    md += `## Detected Incident Spikes\n\n`;

    if (incidents.length === 0) {
      md += `No incident spikes detected in the specified time window.\n`;
      return md;
    }

    md += `| App | Platform | Version | Category | Severity | Reports | Status | First Seen |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const inc of incidents) {
      const firstSeenShort = inc.firstSeenAt.slice(0, 16).replace('T', ' ');
      md += `| ${inc.appName} | ${inc.platform.toUpperCase()} | \`${inc.appVersion}\` | \`${inc.category}\` | \`${inc.severity}\` | ${inc.reviewCount} | ${inc.status} | ${firstSeenShort} |\n`;
    }

    md += `\n## Incident Details\n\n`;

    for (const inc of incidents) {
      const devices: string[] = JSON.parse(inc.deviceModelsJson || '[]');
      const osVersions: string[] = JSON.parse(inc.osVersionsJson || '[]');
      const devStr = devices.length > 0 ? devices.join(', ') : 'None extracted';
      const osStr = osVersions.length > 0 ? osVersions.join(', ') : 'None extracted';

      md += `### ${inc.appName} (${inc.platform.toUpperCase()} v${inc.appVersion}) - ${inc.category}\n\n`;
      md += `* Root Cause: ${inc.rootCauseSummary}\n`;
      md += `* Severity: \`${inc.severity}\`\n`;
      md += `* Affected Devices: ${devStr}\n`;
      md += `* Operating Systems: ${osStr}\n`;
      md += `* Total Reports: ${inc.reviewCount}\n`;
      md += `* First Seen: ${inc.firstSeenAt}\n`;
      md += `* Last Seen: ${inc.lastSeenAt}\n\n`;
    }

    return md;
  }

  private generateHtmlReport(
    days: number,
    stats: ReturnType<DatabaseManager['getStats']>,
    incidents: ReturnType<IncidentStore['listIncidents']>
  ): string {
    let rows = '';
    for (const inc of incidents) {
      const isCritical = inc.severity === 'P1_CRITICAL';
      const badgeClass = isCritical ? 'badge-critical' : 'badge-high';
      const devices: string[] = JSON.parse(inc.deviceModelsJson || '[]');
      const devStr = devices.slice(0, 2).join(', ') || 'N/A';

      rows += `
        <tr>
          <td><strong>${inc.appName}</strong></td>
          <td>${inc.platform.toUpperCase()}</td>
          <td><code>${inc.appVersion}</code></td>
          <td><code>${inc.category}</code></td>
          <td><span class="badge ${badgeClass}">${inc.severity}</span></td>
          <td><strong>${inc.reviewCount}</strong></td>
          <td>${devStr}</td>
          <td>${inc.status}</td>
          <td>${inc.firstSeenAt.slice(0, 16).replace('T', ' ')}</td>
        </tr>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AppSentinel Incident Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .metric-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: 700; color: #38bdf8; }
    .metric-label { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid #334155; }
    th, td { padding: 12px 16px; text-align: left; font-size: 14px; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #cbd5e1; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-critical { background: #ef4444; color: #fff; }
    .badge-high { background: #f59e0b; color: #000; }
  </style>
</head>
<body>
  <h1>AppSentinel Incident Digest</h1>
  <div class="subtitle">Evaluated over the past ${days} days. Generated ${new Date().toISOString()}</div>

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-val">${stats.totalReviews}</div>
      <div class="metric-label">Total Reviews Ingested</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${stats.triagedReviews}</div>
      <div class="metric-label">Negative Reviews Triaged</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${stats.totalIncidents}</div>
      <div class="metric-label">Spike Incidents</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${stats.activeIncidents}</div>
      <div class="metric-label">Active Incidents</div>
    </div>
  </div>

  <h2>Recorded Spikes</h2>
  <table>
    <thead>
      <tr>
        <th>App</th>
        <th>Platform</th>
        <th>Version</th>
        <th>Category</th>
        <th>Severity</th>
        <th>Reports</th>
        <th>Devices</th>
        <th>Status</th>
        <th>First Seen</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="9">No incidents recorded in this period.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
  }
}
