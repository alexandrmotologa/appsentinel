# Engineering Specification & Implementation Blueprint: AppSentinel
> Automated App Store & Google Play Review Triage, Crash Spikes & Incident Alerter

---

## 1. Executive Summary & Problem Space

### 1.1 The Silent Release Failure Mode in Mobile Apps
For studios publishing games and mobile apps at scale (100M+ downloads), public app reviews are the fastest barometer of real user sentiment. When an update introduces a critical bug (such as an in-app purchase failure, a black screen on Android 14, or a crash on a specific GPU chipset), affected users leave 1-star reviews hours before automated crash reporting tools (Firebase Crashlytics, Sentry) aggregate enough stack traces.

Current operational workflows suffer from three major issues:
1. **Drowning in Review Volume:** Support teams cannot read hundreds or thousands of daily reviews manually across 30 regional app stores. Critical crash reports get buried under generic complaints.
2. **Delayed Anomaly Detection:** By the time a support lead notices a spike in crash reports 24-48 hours later, the app's store rating has plummeted from 4.8 to 3.8, drastically hurting organic conversion and search ranking.
3. **Missing Hardware Context:** Developers need actionable triage: which phone model, which OS version, and which app update caused the issue, rather than just "it doesn't work".

### 1.2 The Solution: AppSentinel
**AppSentinel** is a lightweight background worker and incident alerting engine built in **TypeScript and Node.js** that continuously monitors public App Store and Google Play review streams, classifies negative feedback, and alerts engineering teams to crash spikes in real time.

* **Zero-Cost RSS & API Ingestion:** Ingests live review feeds across target countries (US, UK, Germany, Brazil, Japan) via standard public RSS feeds and Google Play developer APIs every 15-30 minutes.
* **Intelligent Negative Triage:** Automatically filters reviews rated <= 2 stars and routes them to a fast, low-cost LLM (Claude 3.5 Haiku or GPT-4o-mini).
* **Structured Incident Classification:** Extracts:
  * Incident Category (`CRASH`, `IN_APP_PURCHASE_FAIL`, `ACCOUNT_LOGIN`, `AD_BLOCKED`, `GAMEPLAY_BUG`).
  * Hardware Metadata (extracted device models like "Galaxy S23", OS versions, and app version).
  * Root Cause Summary (a 1-sentence plain-language explanation of what triggered the failure).
* **Automated Spike Detection & Telegram / Slack Alerts:** Tracks rolling 1-hour issue frequencies. If 3 or more users report crashes on the same app version within 60 minutes, AppSentinel fires an urgent incident alert with direct deep links to the affected reviews.

---

## 2. Technical Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AppSentinel Architecture                        │
└────────────────────────────────────────────────────────────────────────┘

[ Sources: App Store RSS Feed + Google Play Scraper / API ]
                             │ (Runs every 15-30 mins)
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     AppSentinel Core Ingestion Worker                  │
├────────────────────────────────────────────────────────────────────────┤
│  1. Ingestion & Pre-Filter                                             │
│     ├── Fetches latest customer reviews across regional feeds          │
│     ├── Filters out 4-star and 5-star positive feedback                │
│     └── Deduplicates review IDs using local SQLite cache               │
├────────────────────────────────────────────────────────────────────────┤
│  2. LLM Triage & Root-Cause Extractor (Claude 3.5 Haiku / GPT-4o-mini) │
│     ├── Categorizes: CRASH | PAYMENT_FAIL | AD_FREEZE | GAMEPLAY       │
│     ├── Extracts device model, OS version, and app version             │
│     └── Assesses Severity: P1 (Blocker/Crash) vs P3 (Minor Glitch)     │
├────────────────────────────────────────────────────────────────────────┤
│  3. Anomaly & Frequency Detector                                       │
│     ├── Sliding 60-minute window count per category & app version      │
│     └── Triggers Spike Alert if (P1 crashes >= 3 in 1 hour)            │
└────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
[ Telegram Bot Channel ] OR [ Slack Webhook (#mobile-alerts) ]
```

---

## 3. Directory & File Structure

```
appsentinel/
├── bin/
│   └── appsentinel.js              # CLI executable entry point
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── monitor.ts          # appsentinel monitor --config apps.config.json
│   │   │   └── test-alert.ts       # appsentinel test-alert --webhook <url>
│   │   └── index.ts
│   ├── core/
│   │   ├── alerts/
│   │   │   ├── slack-notifier.ts   # Formats Slack block kit cards
│   │   │   └── telegram-bot.ts     # Dispatches markdown messages to Telegram
│   │   ├── classifier/
│   │   │   ├── llm-triage.ts       # Structured triage prompt with Claude Haiku
│   │   │   └── schema.ts           # Zod schema for structured incident JSON
│   │   ├── detector/
│   │   │   └── spike-detector.ts   # Rolling window frequency counter
│   │   ├── fetchers/
│   │   │   ├── app-store-rss.ts    # Apple App Store RSS feed parser
│   │   │   └── google-play.ts      # Google Play review fetcher
│   │   └── storage/
│   │       ├── cache.ts            # SQLite deduplication store
│   │       └── schema.sql
│   └── types/
│       └── index.ts
├── examples/
│   └── apps.config.json            # Configuration with app IDs and webhook URLs
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. 2-Minute Elevator Pitch for Interviews

* **Where data comes from (Source):** Public App Store RSS feeds and Google Play review feeds across major worldwide markets, polled automatically every 15-30 minutes.
* **How it is processed (Logic):** Positive reviews are skipped. Negative reviews (1-2 stars) are sent to Claude 3.5 Haiku, which parses the text in under 1 second into structured JSON: category (`CRASH`, `PAYMENT`), device model, and exact root cause. A rolling sliding-window detector monitors if multiple users report the same issue in a short time frame.
* **Where data lands (Destination):** An urgent alert card is posted directly into the developers' Telegram channel or Slack `#mobile-alerts`, detailing the exact bug and device.
* **Cost & Time Impact:** Running this for 1,000 daily reviews costs less than **$0.10 per day** ($3 per month). It reduces critical bug discovery time from **48 hours down to 15 minutes**, preventing rating crashes after new updates.
