# AppSentinel Configuration Reference

AppSentinel uses a JSON configuration file to define monitored mobile apps, alert channels, classifier providers, and spike detection thresholds.

## Configuration Schema

```json
{
  "pollIntervalMinutes": 15,
  "databasePath": "./data/appsentinel.db",
  "server": {
    "enabled": true,
    "port": 3456,
    "host": "0.0.0.0"
  },
  "classifier": {
    "provider": "local",
    "model": "rule-based",
    "apiKey": "",
    "maxTokens": 400
  },
  "detection": {
    "windowMinutes": 60,
    "spikeThreshold": 3,
    "cooldownMinutes": 60,
    "minSeverity": "P1_CRITICAL"
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
    },
    "webhook": {
      "enabled": false,
      "url": "",
      "secret": ""
    },
    "discord": {
      "enabled": false,
      "webhookUrl": ""
    },
    "teams": {
      "enabled": false,
      "webhookUrl": ""
    }
  },
  "apps": [
    {
      "id": "instagram-ios",
      "platform": "ios",
      "appId": "389801252",
      "name": "Instagram",
      "countries": ["us", "gb", "de", "jp"]
    },
    {
      "id": "spotify-android",
      "platform": "android",
      "appId": "com.spotify.music",
      "name": "Spotify",
      "countries": ["us"]
    }
  ]
}
```

## Configuration Options

### Top-Level Fields

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `pollIntervalMinutes` | number | `15` | Polling interval for background daemon mode. |
| `databasePath` | string | `./data/appsentinel.db` | File path for SQLite database. Created if missing. |
| `server` | object | `{ "enabled": false, "port": 3456 }` | Embedded HTTP status and Prometheus metrics server. |
| `classifier` | object | `{ "provider": "local" }` | Triage classification engine settings. |
| `detection` | object | `{ "windowMinutes": 60, "spikeThreshold": 3 }` | Anomaly detection thresholds and cooldown times. |
| `alerts` | object | `{}` | Outbound alert channels. |
| `apps` | array | `[]` | List of applications to monitor. |

### Classifier Settings

The `classifier.provider` field selects the triage engine:

* `local`: Deterministic regex and rule engine. No API key or network access required.
* `anthropic`: Anthropic Claude API (defaults to `claude-3-5-haiku-latest`).
* `openai`: OpenAI API (defaults to `gpt-4o-mini`).
* `gemini`: Google Gemini API (defaults to `gemini-1.5-flash`).

When an external provider is selected, AppSentinel checks `classifier.apiKey` in the config file, or falls back to standard environment variables:

* `ANTHROPIC_API_KEY`
* `OPENAI_API_KEY`
* `GEMINI_API_KEY`

If the configured provider fails or credentials are unset, AppSentinel falls back to the `local` classifier to prevent ingestion disruption.

### Detection Settings

* `windowMinutes`: Size of the rolling evaluation window in minutes.
* `spikeThreshold`: Minimum count of severe incidents within the window required to trigger an alert.
* `cooldownMinutes`: Period during which duplicate alerts for an active incident cluster are suppressed.
* `minSeverity`: Minimum severity required to count towards a spike (`P1_CRITICAL` or `P2_HIGH`).

### Alert Channels

#### Slack

Set `alerts.slack.enabled` to `true` and supply an incoming webhook URL:

```json
"slack": {
  "enabled": true,
  "webhookUrl": "https://hooks.slack.com/services/T00/B00/XXXX"
}
```

#### Telegram

Set `alerts.telegram.enabled` to `true`, then provide the bot token and destination chat ID:

```json
"telegram": {
  "enabled": true,
  "botToken": "123456789:ABCdefGhIJKlmNoPQRstuVWXyz",
  "chatId": "-1001234567890"
}
```

#### Generic Webhook

Set `alerts.webhook.enabled` to `true` and provide target endpoint URL and optional secret header:

```json
"webhook": {
  "enabled": true,
  "url": "https://api.internal.corp/alerts/mobile",
  "secret": "your-hmac-or-bearer-secret"
}
```

### App Definitions

Each entry in `apps` must define:

* `id`: Unique internal string slug.
* `platform`: Either `ios` or `android`.
* `appId`: Apple numeric App Store ID (e.g., `389801252`) or Google Play package name (e.g., `com.spotify.music`).
* `name`: Human-readable display label.
* `countries`: Array of two-letter ISO country codes to poll (e.g., `["us", "gb", "de"]`).

## Environment Variable Overrides

Configuration fields can reference environment variables using `${VAR_NAME}` syntax:

```json
"slack": {
  "enabled": true,
  "webhookUrl": "${SLACK_WEBHOOK_URL}"
}
```
