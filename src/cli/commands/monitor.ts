import { ConfigLoader } from '../../core/config-loader.js';
import { MonitoringPipeline } from '../../core/pipeline.js';
import { EmbeddedServer } from '../../core/server/server.js';
import { TerminalFormatters } from '../formatters.js';

export async function monitorCommand(options: {
  config?: string;
  interval?: string;
  dryRun?: boolean;
  verbose?: boolean;
  port?: string;
}): Promise<void> {
  TerminalFormatters.banner();
  const config = ConfigLoader.load(options.config);

  const pollIntervalMinutes = options.interval
    ? parseInt(options.interval, 10)
    : config.pollIntervalMinutes || 15;

  const pollIntervalMs = Math.max(1, pollIntervalMinutes) * 60 * 1000;

  TerminalFormatters.info(
    `Starting AppSentinel daemon with ${pollIntervalMinutes}m interval across ${config.apps.length} apps.`
  );

  const pipeline = new MonitoringPipeline(config);
  let server: EmbeddedServer | null = null;

  if (config.server?.enabled || options.port) {
    const port = options.port ? parseInt(options.port, 10) : config.server?.port || 3456;
    server = new EmbeddedServer(pipeline.getDbManager(), pipeline.getIncidentStore());
    await server.listen(port, config.server?.host || '0.0.0.0');
    TerminalFormatters.success(`Embedded HTTP monitor server listening on http://localhost:${port}`);
  }

  let isRunning = true;

  const shutdown = async () => {
    if (!isRunning) return;
    isRunning = false;
    TerminalFormatters.warn('\nShutting down AppSentinel daemon cleanly...');
    if (server) {
      await server.close();
    }
    pipeline.close();
    TerminalFormatters.success('Daemon stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Immediate first run
  const runTick = async () => {
    if (!isRunning) return;
    const now = new Date().toLocaleTimeString();
    TerminalFormatters.info(`[${now}] Polling store feeds...`);
    try {
      const result = await pipeline.runCycle({
        dryRun: options.dryRun,
        verbose: options.verbose,
      });

      console.log(
        `  Processed in ${result.durationMs}ms: +${result.newReviewsCount} reviews, ${result.triagedCount} triaged, ${result.spikesDetected.length} spikes, ${result.alertsDispatched} alerts.`
      );

      for (const spike of result.spikesDetected) {
        TerminalFormatters.incident(
          spike.severity,
          spike.appName,
          spike.appVersion,
          spike.category,
          spike.reviewCount,
          spike.rootCauseSummary
        );
      }
    } catch (err) {
      TerminalFormatters.error(
        `Cycle execution error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  await runTick();

  // Schedule loop
  const intervalId = setInterval(runTick, pollIntervalMs);

  // Keep process alive
  await new Promise(() => {});
}
