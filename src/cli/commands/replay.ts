import { ClassifierFactory } from '../../core/classifier/factory.js';
import { FixtureLoader } from '../../core/fetchers/fixtures.js';
import { ReplayRunner } from '../../core/reporting/replay-runner.js';
import type { DetectionConfig, MonitoredApp } from '../../types/config.js';
import { TerminalFormatters } from '../formatters.js';

export async function replayCommand(options: {
  dataset: string;
  window?: string;
  threshold?: string;
  provider?: 'local' | 'anthropic' | 'openai' | 'gemini';
  appId?: string;
  appName?: string;
  platform?: 'ios' | 'android';
}): Promise<void> {
  TerminalFormatters.banner();
  TerminalFormatters.info(`Loading dataset from ${options.dataset}...`);

  const reviews = FixtureLoader.loadFromFile(options.dataset);
  TerminalFormatters.success(`Loaded ${reviews.length} reviews for replay simulation.`);

  const app: MonitoredApp = {
    id: options.appId || reviews[0]?.appId || 'replay.app',
    name: options.appName || reviews[0]?.appName || 'Replay App',
    platform: (options.platform || reviews[0]?.platform || 'ios') as 'ios' | 'android',
    appId: options.appId || reviews[0]?.appId || 'replay.app',
    countries: ['us'],
  };

  const detectionConfig: DetectionConfig = {
    windowMinutes: options.window ? parseInt(options.window, 10) : 60,
    spikeThreshold: options.threshold ? parseInt(options.threshold, 10) : 3,
    cooldownMinutes: 60,
    minSeverity: 'P1_CRITICAL',
  };

  const classifier = ClassifierFactory.create({ provider: options.provider || 'local' });
  const runner = new ReplayRunner(classifier);

  TerminalFormatters.info(`Running simulation with sliding window ${detectionConfig.windowMinutes}m, threshold ${detectionConfig.spikeThreshold}...`);

  const result = await runner.runReplay(reviews, app, detectionConfig);

  TerminalFormatters.success(`Replay completed in ${result.durationMs}ms:\n`);
  console.log(`  Total Reviews Processed:    ${result.totalProcessed}`);
  console.log(`  Negative Reviews Triaged:   ${result.triagedCount}`);
  console.log(`  Positive Reviews Skipped:   ${result.skippedPositiveCount}`);
  console.log(`  Incident Spikes Detected:   ${result.detectedSpikes.length}`);
  console.log(`  Simulated Alerts Fired:     ${result.alertsTriggered}`);
  console.log(`  Alerts Suppressed Cooldown: ${result.alertsSuppressed}\n`);

  for (const spike of result.detectedSpikes) {
    TerminalFormatters.incident(
      spike.severity,
      spike.appName,
      spike.appVersion,
      spike.category,
      spike.reviewCount,
      spike.rootCauseSummary
    );
  }
}
