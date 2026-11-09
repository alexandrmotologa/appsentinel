import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class DatabaseManager {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(path.resolve(dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    // Enable WAL mode and foreign keys for high concurrency and performance
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.db.exec('PRAGMA foreign_keys = ON;');

    const schemaPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      'schema.sql'
    );

    let ddl: string;
    if (fs.existsSync(schemaPath)) {
      ddl = fs.readFileSync(schemaPath, 'utf8');
    } else {
      // Inlined fallback if schema.sql is not found in compiled dist
      ddl = `
        CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fingerprint TEXT UNIQUE NOT NULL,
          external_id TEXT NOT NULL,
          app_id TEXT NOT NULL,
          app_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          country TEXT NOT NULL,
          author TEXT NOT NULL,
          rating INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          version TEXT,
          review_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'raw',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_fingerprint ON reviews(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_reviews_app_date ON reviews(app_id, review_date);
        CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
        CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

        CREATE TABLE IF NOT EXISTS triaged_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
          fingerprint TEXT NOT NULL,
          app_id TEXT NOT NULL,
          category TEXT NOT NULL,
          severity TEXT NOT NULL,
          device_model TEXT,
          os_version TEXT,
          extracted_version TEXT,
          root_cause_summary TEXT NOT NULL,
          actionable_bug_report INTEGER NOT NULL DEFAULT 0,
          sentiment_score REAL NOT NULL DEFAULT 0.0,
          keywords_json TEXT NOT NULL DEFAULT '[]',
          classifier_provider TEXT NOT NULL,
          triaged_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_triaged_review_id ON triaged_reviews(review_id);
        CREATE INDEX IF NOT EXISTS idx_triaged_category ON triaged_reviews(category);
        CREATE INDEX IF NOT EXISTS idx_triaged_severity ON triaged_reviews(severity);
        CREATE INDEX IF NOT EXISTS idx_triaged_app_date ON triaged_reviews(app_id, triaged_at);

        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          cluster_fingerprint TEXT NOT NULL,
          app_id TEXT NOT NULL,
          app_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          category TEXT NOT NULL,
          app_version TEXT NOT NULL,
          severity TEXT NOT NULL,
          review_count INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          first_seen_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          last_alert_at TEXT,
          resolved_at TEXT,
          root_cause_summary TEXT NOT NULL,
          device_models_json TEXT NOT NULL DEFAULT '[]',
          os_versions_json TEXT NOT NULL DEFAULT '[]',
          sample_reviews_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_incidents_cluster ON incidents(cluster_fingerprint);
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
        CREATE INDEX IF NOT EXISTS idx_incidents_app ON incidents(app_id, updated_at);

        CREATE TABLE IF NOT EXISTS incident_alerts (
          id TEXT PRIMARY KEY,
          incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          payload_json TEXT NOT NULL,
          sent_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_incident_alerts_inc ON incident_alerts(incident_id);
        CREATE INDEX IF NOT EXISTS idx_incident_alerts_sent ON incident_alerts(sent_at);

        CREATE TABLE IF NOT EXISTS schema_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `;
    }

    this.db.exec(ddl);

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)'
    );
    stmt.run('version', '1.0.0');
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  public getStats(): {
    totalReviews: number;
    triagedReviews: number;
    totalIncidents: number;
    activeIncidents: number;
    alertsDispatched: number;
    dbSizeKilobytes: number;
  } {
    const totalReviews = (
      this.db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number }
    ).count;

    const triagedReviews = (
      this.db.prepare('SELECT COUNT(*) as count FROM triaged_reviews').get() as { count: number }
    ).count;

    const totalIncidents = (
      this.db.prepare('SELECT COUNT(*) as count FROM incidents').get() as { count: number }
    ).count;

    const activeIncidents = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'active'")
        .get() as { count: number }
    ).count;

    const alertsDispatched = (
      this.db.prepare('SELECT COUNT(*) as count FROM incident_alerts').get() as { count: number }
    ).count;

    let dbSizeKilobytes = 0;
    if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
      dbSizeKilobytes = Math.round(fs.statSync(this.dbPath).size / 1024);
    }

    return {
      totalReviews,
      triagedReviews,
      totalIncidents,
      activeIncidents,
      alertsDispatched,
      dbSizeKilobytes,
    };
  }
}
