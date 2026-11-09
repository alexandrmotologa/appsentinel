import type { DatabaseManager } from '../storage/database.js';

export class PrometheusMetrics {
  private dbManager: DatabaseManager;
  private startTime: number;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.startTime = Date.now();
  }

  public exportMetrics(): string {
    const stats = this.dbManager.getStats();
    const uptimeSeconds = Math.round((Date.now() - this.startTime) / 1000);
    const dbSizeBytes = stats.dbSizeKilobytes * 1024;

    const lines: string[] = [
      '# HELP appsentinel_uptime_seconds Total runtime of AppSentinel process in seconds',
      '# TYPE appsentinel_uptime_seconds counter',
      `appsentinel_uptime_seconds ${uptimeSeconds}`,
      '',
      '# HELP appsentinel_reviews_total Total ingested reviews by processing status',
      '# TYPE appsentinel_reviews_total gauge',
      `appsentinel_reviews_total{status="all"} ${stats.totalReviews}`,
      `appsentinel_reviews_total{status="triaged"} ${stats.triagedReviews}`,
      '',
      '# HELP appsentinel_incidents_total Total recorded incident spikes',
      '# TYPE appsentinel_incidents_total gauge',
      `appsentinel_incidents_total{status="all"} ${stats.totalIncidents}`,
      `appsentinel_incidents_total{status="active"} ${stats.activeIncidents}`,
      '',
      '# HELP appsentinel_alerts_dispatched_total Total outbound alert messages dispatched',
      '# TYPE appsentinel_alerts_dispatched_total counter',
      `appsentinel_alerts_dispatched_total ${stats.alertsDispatched}`,
      '',
      '# HELP appsentinel_database_size_bytes Total size of SQLite database file on disk',
      '# TYPE appsentinel_database_size_bytes gauge',
      `appsentinel_database_size_bytes ${dbSizeBytes}`,
      '',
    ];

    return lines.join('\n');
  }
}
