import { ConfigLoader } from '../../core/config-loader.js';
import { MonitoringPipeline } from '../../core/pipeline.js';
import { TerminalFormatters } from '../formatters.js';

export async function checkCommand(options: {
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
}): Promise<void> {
  TerminalFormatters.banner();
  TerminalFormatters.info('Running single-pass monitoring check...');

  const config = ConfigLoader.load(options.config);
  const pipeline = new MonitoringPipeline(config);

  try {
    const result = await pipeline.runCycle({
      dryRun: options.dryRun,
      verbose: options.verbose,
    });

    TerminalFormatters.success(
      `Check completed in ${result.durationMs}ms across ${result.appsChecked} apps.`
    );
    console.log(`  New reviews ingested:   ${result.newReviewsCount}`);
    console.log(`  Negative reviews triaged: ${result.triagedCount}`);
    console.log(`  Spike clusters detected: ${result.spikesDetected.length}`);
    console.log(`  Alerts dispatched:       ${result.alertsDispatched}\n`);

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
  } finally {
    pipeline.close();
  }
}
