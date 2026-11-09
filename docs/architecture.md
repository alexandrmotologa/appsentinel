# AppSentinel Architecture

AppSentinel is a Node.js and TypeScript service that ingests public customer reviews from the Apple App Store and Google Play Store, classifies negative reports with LLM triage, detects incident spikes across rolling time windows, and delivers alerts to Slack, Telegram, and webhooks.

## System Overview

```
                                  [ External Review Sources ]
                                  ├── Apple App Store RSS (JSON/XML)
                                  └── Google Play Review Streams
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ Ingestion Pipeline    │
                                    │ ├── Country Polling   │
                                    │ ├── Rating Filter     │
                                    │ └── Review Hash Dedupe│
                                    └───────────┬───────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ SQLite Storage Layer  │
                                    │ ├── reviews           │
                                    │ ├── triaged_reviews   │
                                    │ ├── incidents         │
                                    │ └── incident_alerts   │
                                    └───────────┬───────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
        ┌─────────────────────────┐                           ┌─────────────────────────┐
        │ Rating <= 2 Stars       │                           │ Rating >= 3 Stars       │
        │ Triage Queue            │                           │ Direct Storage          │
        └────────────┬────────────┘                           │ (No LLM Tokens Used)    │
                     │                                        └─────────────────────────┘
                     ▼
        ┌─────────────────────────┐
        │ LLM / Heuristic Triage  │
        │ ├── Category & Severity │
        │ ├── Device Model & OS   │
        │ └── Root Cause Summary  │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │ Sliding Window Detector │
        │ ├── Rolling 60m Window  │
        │ ├── Cluster by Version  │
        │ └── Threshold Trigger   │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │ Alert Dispatcher        │
        │ ├── Cooldown Filter     │
        │ ├── Slack Block Kit     │
        │ ├── Telegram Markdown   │
        │ └── Custom Webhook      │
        └─────────────────────────┘
```

## Core Pipeline Stages

### 1. Ingestion and Pre-Filtering

AppSentinel polls review feeds at configured intervals (default: 15 minutes). For iOS apps, it queries the iTunes RSS customer review endpoint per target country code. For Android apps, it polls Google Play review endpoints.

Each incoming review is assigned a SHA-256 fingerprint generated from the platform, application identifier, and review ID. If the fingerprint exists in the SQLite store, the review is discarded immediately.

Reviews with ratings of 3, 4, or 5 stars bypass triage entirely. They are inserted into the database to track overall volume and sentiment ratios, but consume zero LLM API credits.

### 2. Triage Classification

Reviews with ratings of 1 or 2 stars are forwarded to the triage classifier. The classifier extracts:

* Category: `CRASH`, `IN_APP_PURCHASE_FAIL`, `ACCOUNT_LOGIN`, `AD_BLOCKED`, `GAMEPLAY_BUG`, `PERFORMANCE_LAG`, `NETWORK_ERROR`, `UI_GLITCH`, `OTHER`.
* Severity: `P1_CRITICAL`, `P2_HIGH`, `P3_MEDIUM`, `P4_LOW`.
* Hardware context: extracted device model (such as "iPhone 15 Pro", "Galaxy S23"), operating system version, and app version.
* Summary: a one or two sentence root-cause summary.

The classifier supports multiple backends: Anthropic Claude, OpenAI, Google Gemini, and a deterministic local heuristic engine. If an external API key is missing or the provider returns a network error, the pipeline falls back to the local engine without failing the monitoring loop.

### 3. Anomaly and Spike Detection

The anomaly detector operates on a sliding time window (default: 60 minutes). It evaluates all triaged negative reviews within the window and clusters them along two dimensions:

* Version cluster: `(appId, appVersion, category)`
* Global category cluster: `(appId, category)`

When the count of `P1_CRITICAL` reviews within a window reaches or exceeds the threshold (default: 3 reviews), the detector creates an incident record and marks it for dispatch.

### 4. Cooldown and Suppression

To prevent alert flooding when a persistent bug generates dozens of reviews, AppSentinel maintains a cooldown registry. Once an alert triggers for an incident cluster, subsequent alerts for that same cluster are suppressed for the duration of the cooldown period (default: 60 minutes), unless the severity escalates.

### 5. Multi-Channel Alert Dispatch

When an incident qualifies for notification, the alert engine dispatches formatted payloads to all configured channels:

* Slack: Block Kit message card containing incident badges, affected device breakdown, review excerpts, and deep links.
* Telegram: Markdown message formatted with incident severity, version tags, and review text.
* Generic Webhook: JSON payload signed with a timestamp header for external consumption.

### 6. Observability and Embedded Server

AppSentinel includes an internal HTTP server that provides:

* `/healthz`: returns JSON status with database health and uptime.
* `/metrics`: exposes Prometheus text metrics tracking ingested reviews, triaged items, active incidents, and dispatch latency.
* `/api/incidents`: REST endpoint returning active and historical incidents.
* `/api/stats`: rolling 24-hour review volume and classification distribution.
