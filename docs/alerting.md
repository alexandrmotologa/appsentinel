# AppSentinel Alerting & Incident Notification

AppSentinel formats and delivers alerts across Slack, Telegram, and generic webhooks whenever a rolling review spike meets incident criteria.

## Incident Criteria & Thresholds

An incident is created when negative reviews (`P1_CRITICAL` or `P2_HIGH`) match the following condition within a rolling time window:

```
Count(P1_CRITICAL reviews in window) >= spikeThreshold (default: 3)
```

Each incident generates a cluster fingerprint based on:
* Application identifier
* App version
* Incident category (such as `CRASH` or `IN_APP_PURCHASE_FAIL`)

## Alert Deduplication & Cooldown

When an incident triggers an alert:

1. The incident fingerprint is saved to SQLite along with a dispatch timestamp.
2. During the subsequent `cooldownMinutes` (default: 60 minutes), subsequent reviews belonging to the same cluster do not trigger new alerts.
3. If an incident escalates (for example, review volume doubles or additional device models crash), an updated notification is dispatched with an escalation tag.
4. When the window expires without further matching reviews, the incident state resets to resolved.

## Channel Layouts

### 1. Slack Block Kit

Slack notifications use Block Kit formatting:

* Header: Severity badge (`CRITICAL INCIDENT SPIKE` or `HIGH SEVERITY ALERT`) and application name.
* Context Block: Store platform, country, detected app version, and detection timestamp.
* Fields: Category, affected device models, review volume in window, and spike velocity.
* Excerpt Section: Direct quotes from the most recent customer reviews reporting the problem.
* Action Buttons: Deep link button opening the app's store page.

### 2. Telegram Bot Markdown

Telegram notifications format incident data using clean markdown:

* Incident level header with status emoji.
* App label, platform icon, and version tag.
* Category indicator and concise root-cause summary.
* Bulleted list of affected device models and OS versions.
* Review quotes and timestamps.

### 3. Discord Webhook Embeds

Discord alerts format incidents into rich, color-coded embed cards:

* Color-coded border: Red for `P1_CRITICAL`, Yellow for `P2_HIGH`.
* Subsystem area tag (such as `STOREKIT_BILLING` or `GPU_RENDER`).
* Actionable engineering mitigation advisory.
* Device breakdown, volume numbers, and sample review blockquotes.

### 4. Microsoft Teams MessageCards

Teams alerts deliver structured cards for incident communication channels:

* Header title with incident severity.
* Subsystem, platform, and version facts list.
* Actionable mitigation recommendations.

### 5. Generic Webhook

Generic webhooks dispatch an HTTP POST request with `Content-Type: application/json`. The payload includes:

```json
{
  "event": "incident.spike_detected",
  "incidentId": "inc_abc123",
  "timestamp": "2026-11-09T18:00:00.000Z",
  "app": {
    "id": "instagram-ios",
    "name": "Instagram",
    "platform": "ios"
  },
  "cluster": {
    "category": "CRASH",
    "severity": "P1_CRITICAL",
    "appVersion": "4.2.0",
    "deviceModels": ["iPhone 15 Pro", "iPhone 14"],
    "reviewCount": 4
  },
  "rootCauseSummary": "App terminates immediately upon opening the checkout sheet.",
  "sampleReviews": [
    {
      "reviewId": "rev_987",
      "author": "User123",
      "rating": 1,
      "text": "Crashes on checkout immediately after 4.2.0 update.",
      "date": "2026-11-09T17:52:00.000Z"
    }
  ]
}
```
