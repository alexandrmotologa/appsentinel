import type { DatabaseSync } from 'node:sqlite';
import type { IncidentCluster, IncidentRecord, IncidentStatus } from '../../types/incident.js';
import type { DatabaseManager } from './database.js';

export class IncidentStore {
  private db: DatabaseSync;

  constructor(dbManager: DatabaseManager) {
    this.db = dbManager.getRawDb();
  }

  public getActiveIncidentByFingerprint(fingerprint: string): IncidentRecord | null {
    const row = this.db
      .prepare(`
        SELECT id, cluster_fingerprint as clusterFingerprint, app_id as appId,
               app_name as appName, platform, category, app_version as appVersion,
               severity, review_count as reviewCount, status,
               first_seen_at as firstSeenAt, last_seen_at as lastSeenAt,
               last_alert_at as lastAlertAt, resolved_at as resolvedAt,
               root_cause_summary as rootCauseSummary,
               device_models_json as deviceModelsJson,
               os_versions_json as osVersionsJson,
               sample_reviews_json as sampleReviewsJson
        FROM incidents
        WHERE cluster_fingerprint = ? AND status != 'resolved'
        ORDER BY updated_at DESC
        LIMIT 1
      `)
      .get(fingerprint) as IncidentRecord | undefined;

    return row || null;
  }

  public upsertIncident(cluster: IncidentCluster, status: IncidentStatus = 'active'): IncidentRecord {
    const now = new Date().toISOString();
    const existing = this.getActiveIncidentByFingerprint(cluster.id);

    const deviceModelsJson = JSON.stringify(cluster.deviceModels);
    const osVersionsJson = JSON.stringify(cluster.osVersions);
    const sampleReviewsJson = JSON.stringify(cluster.sampleReviews);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE incidents SET
          review_count = ?,
          severity = ?,
          status = ?,
          last_seen_at = ?,
          root_cause_summary = ?,
          device_models_json = ?,
          os_versions_json = ?,
          sample_reviews_json = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        cluster.reviewCount,
        cluster.severity,
        status,
        cluster.lastSeenAt,
        cluster.rootCauseSummary,
        deviceModelsJson,
        osVersionsJson,
        sampleReviewsJson,
        now,
        existing.id
      );

      return {
        ...existing,
        reviewCount: cluster.reviewCount,
        severity: cluster.severity,
        status,
        lastSeenAt: cluster.lastSeenAt,
        rootCauseSummary: cluster.rootCauseSummary,
        deviceModelsJson,
        osVersionsJson,
        sampleReviewsJson,
      };
    } else {
      const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const stmt = this.db.prepare(`
        INSERT INTO incidents (
          id, cluster_fingerprint, app_id, app_name, platform,
          category, app_version, severity, review_count, status,
          first_seen_at, last_seen_at, last_alert_at, resolved_at,
          root_cause_summary, device_models_json, os_versions_json,
          sample_reviews_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        incidentId,
        cluster.id,
        cluster.appId,
        cluster.appName,
        cluster.platform,
        cluster.category,
        cluster.appVersion,
        cluster.severity,
        cluster.reviewCount,
        status,
        cluster.firstSeenAt,
        cluster.lastSeenAt,
        null,
        null,
        cluster.rootCauseSummary,
        deviceModelsJson,
        osVersionsJson,
        sampleReviewsJson,
        now,
        now
      );

      return {
        id: incidentId,
        clusterFingerprint: cluster.id,
        appId: cluster.appId,
        appName: cluster.appName,
        platform: cluster.platform,
        category: cluster.category,
        appVersion: cluster.appVersion,
        severity: cluster.severity,
        reviewCount: cluster.reviewCount,
        status,
        firstSeenAt: cluster.firstSeenAt,
        lastSeenAt: cluster.lastSeenAt,
        lastAlertAt: null,
        resolvedAt: null,
        rootCauseSummary: cluster.rootCauseSummary,
        deviceModelsJson,
        osVersionsJson,
        sampleReviewsJson,
      };
    }
  }

  public recordAlertDispatched(
    incidentId: string,
    channel: string,
    status: 'sent' | 'failed' | 'suppressed',
    payload: unknown,
    error?: string
  ): void {
    const now = new Date().toISOString();
    const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const stmt = this.db.prepare(`
      INSERT INTO incident_alerts (
        id, incident_id, channel, status, error, payload_json, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      alertId,
      incidentId,
      channel,
      status,
      error ?? null,
      JSON.stringify(payload),
      now
    );

    if (status === 'sent') {
      const updateIncident = this.db.prepare(`
        UPDATE incidents SET last_alert_at = ?, status = 'cooldown' WHERE id = ?
      `);
      updateIncident.run(now, incidentId);
    }
  }

  public listIncidents(options: {
    status?: IncidentStatus;
    limit?: number;
    days?: number;
  } = {}): IncidentRecord[] {
    const { status, limit = 50, days } = options;
    let sql = `
      SELECT id, cluster_fingerprint as clusterFingerprint, app_id as appId,
             app_name as appName, platform, category, app_version as appVersion,
             severity, review_count as reviewCount, status,
             first_seen_at as firstSeenAt, last_seen_at as lastSeenAt,
             last_alert_at as lastAlertAt, resolved_at as resolvedAt,
             root_cause_summary as rootCauseSummary,
             device_models_json as deviceModelsJson,
             os_versions_json as osVersionsJson,
             sample_reviews_json as sampleReviewsJson
      FROM incidents
    `;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (days) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      conditions.push('updated_at >= ?');
      params.push(cutoff);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(sql).all(...params) as unknown as IncidentRecord[];
  }

  public resolveStaleIncidents(staleThresholdMinutes: number = 120): number {
    const cutoff = new Date(Date.now() - staleThresholdMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE incidents
      SET status = 'resolved', resolved_at = ?
      WHERE status != 'resolved' AND last_seen_at < ?
    `);

    const result = stmt.run(now, cutoff);
    return Number(result.changes);
  }
}
