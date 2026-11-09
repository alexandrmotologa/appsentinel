import type { DatabaseManager } from '../storage/database.js';
import type { IncidentStore } from '../storage/incident-store.js';

export class DashboardRenderer {
  public static renderHtml(
    dbManager: DatabaseManager,
    incidentStore: IncidentStore,
    uptimeSeconds: number
  ): string {
    const stats = dbManager.getStats();
    const activeIncidents = incidentStore.listIncidents({ status: 'active', limit: 20 });
    const hours = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeStr = `${hours}h ${mins}m`;

    let incidentRows = '';
    for (const inc of activeIncidents) {
      const devices: string[] = JSON.parse(inc.deviceModelsJson || '[]');
      const devStr = devices.slice(0, 2).join(', ') || 'N/A';

      incidentRows += `
        <tr>
          <td><strong>${inc.appName}</strong></td>
          <td>${inc.platform.toUpperCase()}</td>
          <td><code>${inc.appVersion}</code></td>
          <td><code>${inc.category}</code></td>
          <td><span class="badge ${inc.severity === 'P1_CRITICAL' ? 'badge-critical' : 'badge-high'}">${inc.severity}</span></td>
          <td><strong>${inc.reviewCount}</strong></td>
          <td>${devStr}</td>
          <td>${inc.lastSeenAt.slice(11, 19)}</td>
        </tr>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>AppSentinel Live Monitor</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
    .title-area h1 { margin: 0; font-size: 22px; font-weight: 700; color: #f8fafc; }
    .title-area p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .status-badge { display: flex; align-items: center; gap: 8px; background: #102a1b; color: #4ade80; border: 1px solid #166534; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; }
    .card-val { font-size: 28px; font-weight: 700; color: #38bdf8; }
    .card-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .table-container { background: #131b2e; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
    .table-title { padding: 16px; font-size: 15px; font-weight: 600; border-bottom: 1px solid #1e293b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; font-size: 13px; border-bottom: 1px solid #1e293b; }
    th { background: #0f172a; color: #94a3b8; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #e2e8f0; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-critical { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .badge-high { background: #78350f; color: #fde68a; border: 1px solid #92400e; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>AppSentinel Monitor</h1>
      <p>Continuous mobile store review triage and incident alerting</p>
    </div>
    <div class="status-badge">
      <div class="status-dot"></div>
      Worker Active &bull; Uptime ${uptimeStr}
    </div>
  </div>

  <div class="metrics">
    <div class="card">
      <div class="card-val">${stats.totalReviews}</div>
      <div class="card-label">Reviews Ingested</div>
    </div>
    <div class="card-val-group card">
      <div class="card-val">${stats.triagedReviews}</div>
      <div class="card-label">Reviews Triaged</div>
    </div>
    <div class="card">
      <div class="card-val" style="color: ${stats.activeIncidents > 0 ? '#ef4444' : '#38bdf8'}">${stats.activeIncidents}</div>
      <div class="card-label">Active Spikes</div>
    </div>
    <div class="card">
      <div class="card-val">${stats.alertsDispatched}</div>
      <div class="card-label">Alerts Sent</div>
    </div>
  </div>

  <div class="table-container">
    <div class="table-title">Active Incident Clusters</div>
    <table>
      <thead>
        <tr>
          <th>App</th>
          <th>Platform</th>
          <th>Version</th>
          <th>Category</th>
          <th>Severity</th>
          <th>Volume</th>
          <th>Devices</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        ${incidentRows || '<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 24px;">No active crash spikes detected. System is running cleanly.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    AppSentinel &bull; Endpoints: <a href="/healthz" style="color:#38bdf8">/healthz</a> &bull; <a href="/metrics" style="color:#38bdf8">/metrics</a> &bull; <a href="/api/incidents" style="color:#38bdf8">/api/incidents</a>
  </div>
</body>
</html>`;
  }
}
