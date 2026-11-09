import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { RawReview, TriagedReview } from '../../types/review.js';
import type { DatabaseManager } from './database.js';

export class ReviewStore {
  private db: DatabaseSync;

  constructor(dbManager: DatabaseManager) {
    this.db = dbManager.getRawDb();
  }

  public static generateFingerprint(platform: string, appId: string, externalId: string): string {
    return crypto
      .createHash('sha256')
      .update(`${platform}:${appId}:${externalId}`)
      .digest('hex');
  }

  public insertReview(review: Omit<RawReview, 'fingerprint'>): {
    inserted: boolean;
    id: number;
    fingerprint: string;
  } {
    const fingerprint = ReviewStore.generateFingerprint(
      review.platform,
      review.appId,
      review.id
    );

    const status = review.rating > 2 ? 'skipped_positive' : 'raw';
    const createdAt = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO reviews (
          fingerprint, external_id, app_id, app_name, platform,
          country, author, rating, title, content, version,
          review_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        fingerprint,
        review.id,
        review.appId,
        review.appName,
        review.platform,
        review.country,
        review.author,
        review.rating,
        review.title,
        review.content,
        review.version ?? null,
        review.date,
        status,
        createdAt
      );

      return {
        inserted: true,
        id: Number(result.lastInsertRowid),
        fingerprint,
      };
    } catch (err: unknown) {
      // Check if duplicate constraint
      const errorMsg = String(err);
      if (errorMsg.includes('UNIQUE constraint failed')) {
        const existing = this.db
          .prepare('SELECT id FROM reviews WHERE fingerprint = ?')
          .get(fingerprint) as { id: number } | undefined;
        return {
          inserted: false,
          id: existing ? existing.id : 0,
          fingerprint,
        };
      }
      throw err;
    }
  }

  public getPendingTriageReviews(limit: number = 50): Array<RawReview & { dbId: number }> {
    const rows = this.db
      .prepare(`
        SELECT id as dbId, fingerprint, external_id as id, app_id as appId,
               app_name as appName, platform, country, author, rating,
               title, content, version, review_date as date
        FROM reviews
        WHERE status = 'raw' AND rating <= 2
        ORDER BY review_date ASC
        LIMIT ?
      `)
      .all(limit) as unknown as Array<RawReview & { dbId: number }>;

    return rows;
  }

  public saveTriagedReview(review: TriagedReview, reviewDbId: number): void {
    const keywordsJson = JSON.stringify(review.triage.keywords ?? []);
    const triagedAt = review.triagedAt || new Date().toISOString();

    this.db.exec('BEGIN TRANSACTION;');
    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO triaged_reviews (
          review_id, fingerprint, app_id, category, severity,
          device_model, os_version, extracted_version, root_cause_summary,
          actionable_bug_report, sentiment_score, keywords_json,
          classifier_provider, triaged_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        reviewDbId,
        review.fingerprint,
        review.appId,
        review.triage.category,
        review.triage.severity,
        review.triage.deviceModel,
        review.triage.osVersion,
        review.triage.extractedVersion,
        review.triage.rootCauseSummary,
        review.triage.actionableBugReport ? 1 : 0,
        review.triage.sentimentScore,
        keywordsJson,
        review.classifierProvider,
        triagedAt
      );

      const updateStmt = this.db.prepare(`
        UPDATE reviews SET status = 'triaged' WHERE id = ?
      `);
      updateStmt.run(reviewDbId);

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getTriagedReviewsInWindow(
    appId: string,
    windowStartIso: string
  ): TriagedReview[] {
    const rows = this.db
      .prepare(`
        SELECT r.external_id as id, r.fingerprint, r.app_id as appId,
               r.app_name as appName, r.platform, r.country, r.author,
               r.rating, r.title, r.content, r.version, r.review_date as date,
               t.category, t.severity, t.device_model as deviceModel,
               t.os_version as osVersion, t.extracted_version as extractedVersion,
               t.root_cause_summary as rootCauseSummary,
               t.actionable_bug_report as actionableBugReport,
               t.sentiment_score as sentimentScore,
               t.keywords_json as keywordsJson,
               t.classifier_provider as classifierProvider,
               t.triaged_at as triagedAt
        FROM triaged_reviews t
        JOIN reviews r ON r.id = t.review_id
        WHERE t.app_id = ? AND r.review_date >= ?
        ORDER BY r.review_date DESC
      `)
      .all(appId, windowStartIso) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      fingerprint: String(row.fingerprint),
      appId: String(row.appId),
      appName: String(row.appName),
      platform: row.platform as 'ios' | 'android',
      country: String(row.country),
      author: String(row.author),
      rating: Number(row.rating),
      title: String(row.title),
      content: String(row.content),
      version: row.version ? String(row.version) : null,
      date: String(row.date),
      triagedAt: String(row.triagedAt),
      classifierProvider: String(row.classifierProvider),
      triage: {
        category: row.category as TriagedReview['triage']['category'],
        severity: row.severity as TriagedReview['triage']['severity'],
        deviceModel: row.deviceModel ? String(row.deviceModel) : null,
        osVersion: row.osVersion ? String(row.osVersion) : null,
        extractedVersion: row.extractedVersion ? String(row.extractedVersion) : null,
        rootCauseSummary: String(row.rootCauseSummary),
        actionableBugReport: Boolean(row.actionableBugReport),
        sentimentScore: Number(row.sentimentScore),
        keywords: JSON.parse(String(row.keywordsJson || '[]')),
      },
    }));
  }

  public calculateHistoricalHourlyRate(appId: string, days: number = 7): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const row = this.db
      .prepare(`
        SELECT COUNT(*) as count, MIN(review_date) as oldestDate
        FROM reviews
        WHERE app_id = ? AND review_date >= ? AND rating <= 2
      `)
      .get(appId, cutoff) as { count: number; oldestDate: string | null } | undefined;

    if (!row || !row.count || !row.oldestDate) {
      return 0.5; // Default minimal floor for cold start
    }

    const elapsedMs = Date.now() - new Date(row.oldestDate).getTime();
    const elapsedHours = Math.max(1, elapsedMs / (60 * 60 * 1000));
    const rate = row.count / elapsedHours;
    return Math.max(0.2, Number(rate.toFixed(2)));
  }

  public pruneReviewsOlderThan(days: number): number {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = this.db
      .prepare('DELETE FROM reviews WHERE created_at < ?')
      .run(cutoffDate);
    return Number(result.changes);
  }

  public exportReviews(format: 'json' | 'csv' = 'json'): string {
    const rows = this.db
      .prepare(`
        SELECT r.id, r.external_id, r.app_id, r.app_name, r.platform,
               r.country, r.rating, r.title, r.content, r.version,
               r.review_date, r.status,
               t.category, t.severity, t.device_model, t.os_version,
               t.root_cause_summary
        FROM reviews r
        LEFT JOIN triaged_reviews t ON t.review_id = r.id
        ORDER BY r.review_date DESC
      `)
      .all() as Array<Record<string, unknown>>;

    if (format === 'json') {
      return JSON.stringify(rows, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'external_id',
      'app_id',
      'app_name',
      'platform',
      'country',
      'rating',
      'version',
      'review_date',
      'status',
      'category',
      'severity',
      'device_model',
      'os_version',
      'title',
      'content',
      'root_cause_summary',
    ];

    const escapeCsv = (str: unknown) => {
      if (str === null || str === undefined) return '';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }
    return lines.join('\n');
  }
}
