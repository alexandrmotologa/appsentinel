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
