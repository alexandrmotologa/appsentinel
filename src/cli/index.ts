import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { dbCleanCommand, dbExportCommand, dbStatsCommand } from './commands/db.js';
import { monitorCommand } from './commands/monitor.js';
import { replayCommand } from './commands/replay.js';
import { reportCommand } from './commands/report.js';
import { serveCommand } from './commands/serve.js';
import { testAlertCommand } from './commands/test-alert.js';
import { triageCommand } from './commands/triage.js';

const program = new Command();

program
  .name('appsentinel')
  .description('Real-time mobile app review triage and incident alerting engine')
  .version('1.0.0');

// Global Options
program.option('-c, --config <path>', 'Path to JSON configuration file');
program.option('-v, --verbose', 'Enable verbose logging');

// Command: monitor
program
  .command('monitor')
  .description('Run continuous background review ingestion and spike detection daemon')
  .option('-i, --interval <minutes>', 'Override polling interval in minutes')
  .option('-p, --port <port>', 'Port for embedded HTTP monitor server')
  .option('--dry-run', 'Process and log without sending outbound alerts')
  .action((options) => {
    const parentOpts = program.opts();
    monitorCommand({ ...parentOpts, ...options });
  });

// Command: check
program
  .command('check')
  .description('Run a single ingestion, triage, and spike detection cycle and exit')
  .option('--dry-run', 'Process and log without sending outbound alerts')
  .action((options) => {
    const parentOpts = program.opts();
    checkCommand({ ...parentOpts, ...options });
  });

// Command: triage
program
  .command('triage <text-or-file>')
  .description('Ad-hoc classification of an arbitrary review string or file')
  .option('--provider <provider>', 'Classifier provider: local, anthropic, openai, gemini', 'local')
  .option('--model <model>', 'Specific model identifier override')
  .action((textOrFile, options) => {
    triageCommand(textOrFile, options);
  });

// Command: test-alert
program
  .command('test-alert')
  .description('Dispatch a test incident notification card to verify alert channels')
  .requiredOption('--channel <channel>', 'Alert channel: slack, telegram, or webhook')
  .option('--webhook <url>', 'Slack incoming webhook URL')
  .option('--token <token>', 'Telegram bot token')
  .option('--chat-id <id>', 'Telegram destination chat ID')
  .option('--url <url>', 'Generic webhook destination URL')
  .option('--secret <secret>', 'Generic webhook auth secret')
  .action((options) => {
    testAlertCommand(options);
  });

// Command: report
program
  .command('report')
  .description('Generate an incident digest report from recorded history')
  .option('-d, --days <days>', 'Number of past days to include in the report', '7')
  .option('-f, --format <format>', 'Report format: markdown, json, or html', 'markdown')
  .option('-o, --output <file>', 'Output file path (prints to stdout if omitted)')
  .action((options) => {
    const parentOpts = program.opts();
    reportCommand({ ...parentOpts, ...options });
  });

// Command: replay
program
  .command('replay')
  .description('Replay a historical review dataset through the detection pipeline')
  .requiredOption('-d, --dataset <path>', 'Path to JSON array review fixture')
  .option('-w, --window <minutes>', 'Sliding window in minutes', '60')
  .option('-t, --threshold <count>', 'Spike trigger threshold count', '3')
  .option('--provider <provider>', 'Classifier provider to use: local, anthropic, openai', 'local')
  .option('--app-id <appId>', 'Override app ID for clustering')
  .option('--app-name <appName>', 'Override app display name')
  .action((options) => {
    replayCommand(options);
  });

// Command: serve
program
  .command('serve')
  .description('Start the embedded status dashboard, health checks, and Prometheus metrics')
  .option('-p, --port <port>', 'HTTP port to bind (default: 3456)', '3456')
  .option('--host <host>', 'Host address to bind (default: 0.0.0.0)', '0.0.0.0')
  .action((options) => {
    const parentOpts = program.opts();
    serveCommand({ ...parentOpts, ...options });
  });

// Command: db
const dbCommand = program.command('db').description('Database inspection and maintenance');

dbCommand
  .command('stats')
  .description('Show database statistics and review counts')
  .action(() => {
    const parentOpts = program.opts();
    dbStatsCommand(parentOpts);
  });

dbCommand
  .command('clean')
  .description('Delete processed reviews older than N days')
  .option('-d, --days <days>', 'Days retention cutoff', '60')
  .action((options) => {
    const parentOpts = program.opts();
    dbCleanCommand({ ...parentOpts, ...options });
  });

dbCommand
  .command('export')
  .description('Export stored reviews to JSON or CSV')
  .option('-f, --format <format>', 'Output format: json or csv', 'json')
  .option('-o, --output <file>', 'Output file path (prints to stdout if omitted)')
  .action((options) => {
    const parentOpts = program.opts();
    dbExportCommand({ ...parentOpts, ...options });
  });

program.parse(process.argv);
