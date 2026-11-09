import type { DatabaseManager } from '../storage/database.js';
import type { IncidentStore } from '../storage/incident-store.js';

export class DashboardRenderer {
  public static renderHtml(
    dbManager: DatabaseManager,
    incidentStore: IncidentStore,
    uptimeSeconds: number
  ): string {
    const stats = dbManager.getStats();
    const incidents = incidentStore.listIncidents({ limit: 50 });
    const hours = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeStr = `${hours}h ${mins}m`;

    // Query top crashing devices
    const deviceRows = dbManager
      .getRawDb()
      .prepare(`
        SELECT device_model as model, COUNT(*) as count
        FROM triaged_reviews
        WHERE category = 'CRASH' AND device_model IS NOT NULL
        GROUP BY device_model
        ORDER BY count DESC
        LIMIT 6
      `)
      .all() as unknown as Array<{ model: string; count: number }>;

    // Query recent reviews
    const recentReviews = dbManager
      .getRawDb()
      .prepare(`
        SELECT r.id, r.app_name, r.platform, r.rating, r.title, r.content,
               r.version, r.review_date, t.category, t.severity, t.device_model
        FROM reviews r
        LEFT JOIN triaged_reviews t ON t.review_id = r.id
        ORDER BY r.review_date DESC
        LIMIT 15
      `)
      .all() as unknown as Array<{
        id: number;
        app_name: string;
        platform: string;
        rating: number;
        title: string;
        content: string;
        version?: string;
        review_date: string;
        category?: string;
        severity?: string;
        device_model?: string;
      }>;

    // Render incident rows
    let incidentRows = '';
    for (const inc of incidents) {
      const devices: string[] = JSON.parse(inc.deviceModelsJson || '[]');
      const devStr = devices.slice(0, 2).join(', ') || 'N/A';
      const isCritical = inc.severity === 'P1_CRITICAL';
      const isResolved = inc.status === 'resolved';
      const isAck = inc.status === 'acknowledged';

      let statusBadge = `<span id="status-${inc.id}" class="badge badge-active">${inc.status.toUpperCase()}</span>`;
      if (isResolved) {
        statusBadge = `<span id="status-${inc.id}" class="badge badge-resolved">RESOLVED</span>`;
      } else if (isAck) {
        statusBadge = `<span id="status-${inc.id}" class="badge badge-ack">ACKNOWLEDGED</span>`;
      }

      const actions = isResolved
        ? '<span style="color:#64748b; font-size:12px;">Closed</span>'
        : `
          <button class="btn btn-sm btn-outline" onclick="handleAction('${inc.id}', 'acknowledge')">Ack</button>
          <button class="btn btn-sm btn-danger" onclick="handleAction('${inc.id}', 'resolve')">Resolve</button>
        `;

      incidentRows += `
        <tr id="row-${inc.id}">
          <td><strong>${inc.appName}</strong></td>
          <td>${inc.platform.toUpperCase()}</td>
          <td><code>${inc.appVersion}</code></td>
          <td><code>${inc.category}</code></td>
          <td><span class="badge ${isCritical ? 'badge-critical' : 'badge-high'}">${inc.severity}</span></td>
          <td><strong>${inc.reviewCount}</strong></td>
          <td>${devStr}</td>
          <td>${statusBadge}</td>
          <td>${inc.lastSeenAt.slice(11, 19)}</td>
          <td>${actions}</td>
        </tr>
      `;
    }

    // Render device chart bars
    let deviceChartHtml = '';
    const maxDeviceCount = deviceRows.length > 0 ? Math.max(...deviceRows.map((d) => d.count)) : 1;
    for (const d of deviceRows) {
      const percent = Math.round((d.count / maxDeviceCount) * 100);
      deviceChartHtml += `
        <div class="chart-row">
          <div class="chart-label">${d.model}</div>
          <div class="chart-bar-container">
            <div class="chart-bar" style="width: ${percent}%;"></div>
          </div>
          <div class="chart-val">${d.count}</div>
        </div>
      `;
    }

    // Render review feed
    let reviewFeedHtml = '';
    for (const r of recentReviews) {
      const starStr = '⭐'.repeat(r.rating);
      const catBadge = r.category
        ? `<span class="badge badge-ack" style="font-size:10px;">${r.category}</span>`
        : '<span class="badge" style="background:#334155; color:#cbd5e1; font-size:10px;">POSITIVE</span>';

      reviewFeedHtml += `
        <div class="review-card">
          <div class="review-header">
            <div>
              <strong>${r.app_name}</strong> &bull; <span style="font-size:11px; color:#94a3b8;">${r.platform.toUpperCase()} v${r.version || 'unknown'}</span>
            </div>
            <div>${catBadge} <span style="font-size:12px; margin-left:6px;">${starStr}</span></div>
          </div>
          <div class="review-title">${r.title || 'No title'}</div>
          <div class="review-content">${r.content.slice(0, 160)}</div>
          <div class="review-meta">${r.device_model ? `Device: ${r.device_model} &bull; ` : ''}${r.review_date.slice(0, 16).replace('T', ' ')}</div>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AppSentinel Live Incident Console</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080d1a; color: #f1f5f9; margin: 0; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
    .title-area h1 { margin: 0; font-size: 22px; font-weight: 700; color: #f8fafc; }
    .title-area p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .status-badge { display: flex; align-items: center; gap: 8px; background: #102a1b; color: #4ade80; border: 1px solid #166534; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; }
    .card-val { font-size: 28px; font-weight: 700; color: #38bdf8; }
    .card-label { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .nav-tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; }
    .tab-btn { background: transparent; border: none; color: #94a3b8; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    .tab-btn.active { background: #1f2937; color: #38bdf8; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .table-container { background: #111827; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 14px; text-align: left; font-size: 13px; border-bottom: 1px solid #1f2937; }
    th { background: #0b1120; color: #94a3b8; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    code { background: #1f2937; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #e2e8f0; }
    .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-critical { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .badge-high { background: #78350f; color: #fde68a; border: 1px solid #92400e; }
    .badge-active { background: #1e3a8a; color: #93c5fd; }
    .badge-ack { background: #3730a3; color: #c7d2fe; }
    .badge-resolved { background: #14532d; color: #86efac; }
    .btn { padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .btn-sm { font-size: 11px; padding: 3px 8px; margin-right: 4px; }
    .btn-outline { background: #1f2937; color: #e2e8f0; border-color: #374151; }
    .btn-outline:hover { background: #374151; }
    .btn-danger { background: #991b1b; color: #fef2f2; }
    .btn-danger:hover { background: #b91c1c; }
    .chart-box { background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 20px; }
    .chart-row { display: flex; align-items: center; margin-bottom: 12px; gap: 12px; }
    .chart-label { width: 220px; font-size: 13px; font-weight: 500; color: #cbd5e1; }
    .chart-bar-container { flex: 1; background: #1f2937; height: 16px; border-radius: 4px; overflow: hidden; }
    .chart-bar { background: linear-gradient(90deg, #38bdf8, #818cf8); height: 100%; border-radius: 4px; }
    .chart-val { width: 40px; text-align: right; font-size: 13px; font-weight: 700; color: #38bdf8; }
    .review-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .review-card { background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 14px; }
    .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .review-title { font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 4px; }
    .review-content { font-size: 13px; color: #94a3b8; line-height: 1.4; }
    .review-meta { font-size: 11px; color: #64748b; margin-top: 8px; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>AppSentinel Incident Console</h1>
      <p>Continuous mobile review triage, hardware extraction and crash spike monitoring</p>
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
    <div class="card">
      <div class="card-val">${stats.triagedReviews}</div>
      <div class="card-label">Negative Triaged</div>
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

  <div class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('incidents')">Incident Clusters (${incidents.length})</button>
    <button class="tab-btn" onclick="switchTab('devices')">Device Breakdown</button>
    <button class="tab-btn" onclick="switchTab('reviews')">Live Review Stream</button>
  </div>

  <!-- Tab: Incidents -->
  <div id="tab-incidents" class="tab-content active">
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>App</th>
            <th>Platform</th>
            <th>Version</th>
            <th>Category</th>
            <th>Severity</th>
            <th>Volume</th>
            <th>Hardware Context</th>
            <th>Status</th>
            <th>Last Report</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${incidentRows || '<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 24px;">No active crash spikes detected. Systems operating normally.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Tab: Devices -->
  <div id="tab-devices" class="tab-content">
    <div class="chart-box">
      <h3 style="margin-top:0; font-size:16px;">Top Hardware Models Affected by Crashes</h3>
      <div style="margin-top: 16px;">
        ${deviceChartHtml || '<p style="color:#64748b;">No crash records with device context yet.</p>'}
      </div>
    </div>
  </div>

  <!-- Tab: Reviews -->
  <div id="tab-reviews" class="tab-content">
    <div class="review-grid">
      ${reviewFeedHtml || '<p style="color:#64748b;">No reviews stored yet.</p>'}
    </div>
  </div>

  <div class="footer">
    AppSentinel Core &bull; <a href="/healthz" style="color:#38bdf8">Healthz</a> &bull; <a href="/metrics" style="color:#38bdf8">Prometheus Metrics</a> &bull; <a href="/api/incidents" style="color:#38bdf8">API Incidents</a>
  </div>

  <script>
    function switchTab(name) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-' + name).classList.add('active');
    }

    async function handleAction(incidentId, action) {
      try {
        const res = await fetch('/api/incidents/' + incidentId + '/' + action, { method: 'POST' });
        if (res.ok) {
          const badge = document.getElementById('status-' + incidentId);
          if (badge) {
            if (action === 'acknowledge') {
              badge.className = 'badge badge-ack';
              badge.textContent = 'ACKNOWLEDGED';
            } else if (action === 'resolve') {
              badge.className = 'badge badge-resolved';
              badge.textContent = 'RESOLVED';
            }
          }
        }
      } catch (err) {
        alert('Action failed: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
  }
}
