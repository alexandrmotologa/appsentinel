# AppSentinel

Real-time incident detection engine that monitors App Store and Google Play review streams, extracts hardware context using LLM triage, and alerts engineering teams to crash spikes via Slack and Telegram.

## Overview

When mobile releases introduce critical bugs, users leave low-star reviews long before automated crash reporting tools aggregate enough diagnostic reports. AppSentinel polls public App Store RSS feeds and Google Play review endpoints, isolates negative reviews, extracts structured hardware and root-cause metadata, and fires alerts when crash frequencies exceed configurable thresholds.

## Key Capabilities

* Multi-store ingestion: Polls Apple App Store customer review RSS feeds and Google Play review streams across multiple regional storefronts.
* Store discovery CLI: Quickly search App Store and Google Play (`appsentinel search`) to discover numeric IDs and package names, then add them with a single command (`appsentinel add`).
* Intelligent triage: Routes reviews with 1 or 2 stars to structured LLM classification (Claude Haiku, GPT-4o-mini, Gemini Flash, or local heuristics) while skipping positive reviews to keep token costs minimal.
* Hardware, subsystem, and mitigation context: Extracts device models, OS versions, release numbers, affected technical subsystems (such as `STOREKIT_BILLING`, `GPU_RENDER`, or `AUTH_SESSION`), and concrete mitigation advice for on-call engineers.
* Anomaly and spike detection: Uses sliding time windows and velocity calculations to track crash spikes and trigger alerts.
* Staged rollout comparator: Compares reliability metrics between releases (`appsentinel compare`) to guide `PROCEED` or `PAUSE_ROLLOUT` decisions during phased releases.
* Localized developer replies: Generates polite, localized reply drafts (`appsentinel draft-reply`) referencing user hardware and operating systems for store consoles.
* Multi-channel alerting: Delivers formatted alert cards to Slack channels, Telegram groups, Discord servers, Microsoft Teams channels, and generic webhook endpoints.
* Embedded health and interactive console: Includes a local HTTP dashboard with incident Acknowledge and Resolve actions, review streams, device breakdown charts, health checks, and Prometheus metrics.

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

* `appsentinel search <query>`: Discovers numeric iOS IDs and Android package names across global app stores.
* `appsentinel add <platform> <appId>`: Adds a monitored application entry directly into `apps.config.json`.
* `appsentinel compare <appId> <v1> <v2>`: Compares crash and sentiment metrics to advise phased rollout pauses.
* `appsentinel draft-reply <incident-id>`: Generates localized customer support responses for store consoles.
* `appsentinel monitor`: Runs continuous background polling with scheduled intervals.
* `appsentinel check`: Executes a one-time ingestion, triage, and detection cycle.
* `appsentinel triage <text>`: Classifies arbitrary text with hardware, subsystem, and mitigation extraction.
* `appsentinel test-alert`: Sends a sample incident card to Slack, Telegram, Discord, Teams, or custom webhooks.
* `appsentinel report`: Generates markdown, JSON, or HTML incident summaries from SQLite history.
* `appsentinel replay`: Runs sliding window anomaly detection against historical review datasets.
* `appsentinel serve`: Starts the HTTP dashboard, health checks (`/healthz`), and Prometheus metrics (`/metrics`).
* `appsentinel db`: Database maintenance, review cleanup, and JSON/CSV export commands.

## License

MIT
