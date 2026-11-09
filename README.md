# AppSentinel

Real-time incident detection engine that monitors App Store and Google Play review streams, extracts hardware context using LLM triage, and alerts engineering teams to crash spikes via Slack and Telegram.

## Overview

When mobile releases introduce critical bugs, users leave low-star reviews long before automated crash reporting tools aggregate enough diagnostic reports. AppSentinel polls public App Store RSS feeds and Google Play review endpoints, isolates negative reviews, extracts structured hardware and root-cause metadata, and fires alerts when crash frequencies exceed configurable thresholds.

## Key Capabilities

* Multi-store ingestion: Polls Apple App Store customer review RSS feeds and Google Play review streams across multiple regional storefronts.
* Intelligent triage: Routes reviews with 1 or 2 stars to structured LLM classification (Claude Haiku, GPT-4o-mini, Gemini Flash, or local heuristics) while skipping positive reviews to keep token costs minimal.
* Hardware and context extraction: Extracts device model, operating system version, app release version, incident category, and concise root-cause summaries.
* Anomaly and spike detection: Uses sliding time windows to track crash velocity. Triggers incident notifications when failure thresholds are met.
* Alert deduplication and cooldown: Suppresses duplicate notifications for ongoing incidents to prevent alert fatigue.
* Multi-channel alerting: Delivers formatted alert cards to Slack channels, Telegram groups, and generic webhook endpoints.
* Embedded health and metrics: Includes a local HTTP endpoint for health checks, incident feeds, and Prometheus metrics.

## Architecture

```
[ App Store RSS Feeds ]    [ Google Play Reviews ]
            │                         │
            └───────────┬─────────────┘
                        ▼
          ┌───────────────────────────┐
          │     AppSentinel Core      │
          ├───────────────────────────┤
          │ 1. Deduplication & Cache  │
          │    (SQLite local store)   │
          ├───────────────────────────┤
          │ 2. Negative Review Filter │
          │    (Stars <= 2)           │
          ├───────────────────────────┤
          │ 3. LLM / Local Triage     │
          │    (Extracts HW & Cause)  │
          ├───────────────────────────┤
          │ 4. Sliding Window Spike   │
          │    (Threshold & Cooldown) │
          └─────────────┬─────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
     [ Slack Webhook ]      [ Telegram Bot ]
```

## Quick Start

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/alexandrmotologa/appsentinel.git
cd appsentinel
npm install
npm run build
```

### Configuration

Create a configuration file `apps.config.json` (or copy from `examples/apps.config.json`):

```json
{
  "pollIntervalMinutes": 15,
  "databasePath": "./data/appsentinel.db",
  "classifier": {
    "provider": "local",
    "model": "rule-based"
  },
  "detection": {
    "windowMinutes": 60,
    "spikeThreshold": 3,
    "cooldownMinutes": 60
  },
  "alerts": {
    "slack": {
      "enabled": false,
      "webhookUrl": ""
    },
    "telegram": {
      "enabled": false,
      "botToken": "",
      "chatId": ""
    }
  },
  "apps": [
    {
      "id": "sample-ios-app",
      "platform": "ios",
      "appId": "389801252",
      "name": "Instagram",
      "countries": ["us", "gb", "de"]
    }
  ]
}
```

### Running AppSentinel

Start the monitoring daemon:

```bash
npm run start -- monitor --config apps.config.json
```

Run a single check pass:

```bash
npm run start -- check --config apps.config.json
```

Triage an individual review string or file directly from the command line:

```bash
npm run start -- triage "The app crashes immediately after opening on my Galaxy S23 running Android 14."
```

Test alert integrations:

```bash
npm run start -- test-alert --channel slack --webhook https://hooks.slack.com/services/...
npm run start -- test-alert --channel telegram --token YOUR_TOKEN --chat-id YOUR_CHAT_ID
```

Start the embedded status dashboard and metrics server:

```bash
npm run start -- serve --port 3456
```

## CLI Reference

* `appsentinel monitor`: Runs continuous background polling with scheduled intervals.
* `appsentinel check`: Executes a one-time ingestion, triage, and detection cycle.
* `appsentinel triage <text>`: Classifies arbitrary text using configured LLM or local classifier.
* `appsentinel test-alert`: Sends a sample incident card to Slack, Telegram, or custom webhooks.
* `appsentinel report`: Generates markdown, JSON, or HTML incident summaries from SQLite history.
* `appsentinel replay`: Runs sliding window anomaly detection against historical review datasets.
* `appsentinel serve`: Starts the HTTP dashboard, health checks (`/healthz`), and Prometheus metrics (`/metrics`).

## License

MIT
