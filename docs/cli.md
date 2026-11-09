# AppSentinel CLI Reference

AppSentinel provides a command-line interface for daemon monitoring, manual pipeline checks, ad-hoc text triage, alert verification, database operations, and historical replays.

## Global Options

All commands accept:

* `-c, --config <path>`: Path to configuration file (default: `./apps.config.json`).
* `-v, --verbose`: Enable debug logging.
* `-h, --help`: Display help and command options.

---

## Commands

### `appsentinel search <query>`

Searches the Apple App Store and Google Play Store to discover numeric iOS track IDs and Android package names, along with ratings, developer information, and categories.

```bash
# Search both stores for an application
appsentinel search "Brawl Stars"

# Search only iOS App Store in the German storefront
appsentinel search "Spotify" --platform ios --country de
```

### `appsentinel add <platform> <appId>`

Appends a new application entry to `apps.config.json` without requiring manual JSON manipulation.

```bash
# Add an iOS application by numeric ID
appsentinel add ios 512939461 --name "Subway Surfers"

# Add an Android application by package ID with multiple storefronts
appsentinel add android com.spotify.music --name "Spotify" --countries us,gb,de
```

### `appsentinel compare <appId> <versionA> <versionB>`

Compares crash rates, star ratings, and billing failures between two release versions to inform staged rollout and phased release decisions (`PROCEED`, `INVESTIGATE`, or `PAUSE_ROLLOUT`).

```bash
appsentinel compare com.superstudio.battlequest 4.1.9 4.2.0
```

### `appsentinel draft-reply <incident-id-or-text>`

Generates a polite, localized developer reply template referencing the user's specific device model, operating system, and release version for store consoles (App Store Connect or Google Play Console).

```bash
# Generate German response for an incident
appsentinel draft-reply inc_1731174981 --lang de

# Generate English reply with dedicated support portal URL
appsentinel draft-reply "Crashes on splash screen on iPhone 15 Pro" --lang en --support-url "https://help.mygame.com"
```

### `appsentinel monitor`

Runs the continuous background monitoring daemon. Polls configured store review streams on the interval defined in the configuration, processes incoming reviews, classifies negative feedback, and triggers alerts on crash spikes.

```bash
# Start daemon with default configuration
appsentinel monitor

# Start daemon with custom config and 10-minute override
appsentinel monitor --config ./configs/prod.json --interval 10

# Run in dry-run mode (triages and logs, but does not send outbound alerts)
appsentinel monitor --dry-run
```

### `appsentinel check`

Executes a single pass across all configured apps and exits. Useful for cron jobs or CI/CD verification pipelines.

```bash
appsentinel check --config ./apps.config.json
```

### `appsentinel triage <text>`

Classifies an arbitrary review string or file path directly without saving to the database. Useful for debugging prompt behavior and validating classification rules.

```bash
# Triage an inline string
appsentinel triage "Since updating to 4.2.0, the app crashes every time I tap checkout on iOS 17.4."

# Triage using specific provider
appsentinel triage "Frequent freezes on Samsung S24" --provider anthropic

# Triage content from a text file
appsentinel triage ./review.txt
```

### `appsentinel test-alert`

Sends a synthetic incident notification card to a specified channel to verify webhook tokens and formatting.

```bash
# Test Slack webhook
appsentinel test-alert --channel slack --webhook https://hooks.slack.com/services/...

# Test Telegram bot
appsentinel test-alert --channel telegram --token 123456:ABC... --chat-id -100...

# Test custom webhook
appsentinel test-alert --channel webhook --url https://api.corp.internal/alert
```

### `appsentinel report`

Generates incident digests and reliability reports from the SQLite database.

```bash
# Generate markdown report for past 7 days
appsentinel report --days 7 --format markdown

# Generate standalone HTML dashboard
appsentinel report --days 14 --format html --output ./incident-report.html

# Export JSON summary
appsentinel report --days 30 --format json --output ./report.json
```

### `appsentinel replay`

Replays a historical review dataset (JSON array of reviews) through the triage and spike detection pipeline to evaluate alert thresholds and detector sensitivity.

```bash
appsentinel replay --dataset ./examples/sample-reviews.json --window 60 --threshold 3
```

### `appsentinel serve`

Starts the embedded HTTP status server, exposing health endpoints, Prometheus metrics, and REST incident feeds.

```bash
# Start server on default port 3456
appsentinel serve

# Start server on custom port
appsentinel serve --port 8080 --host 127.0.0.1
```

### `appsentinel db`

Database maintenance and inspection commands.

```bash
# Display review counts, incident numbers, and database file size
appsentinel db stats

# Clean reviews older than 90 days
appsentinel db clean --days 90

# Export reviews and triage records to CSV or JSON
appsentinel db export --format json --output ./exported-reviews.json
```
