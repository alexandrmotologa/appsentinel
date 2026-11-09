import fs from 'node:fs';
import path from 'node:path';
import { ConfigLoader } from '../../core/config-loader.js';
import { DatabaseManager } from '../../core/storage/database.js';
import { ReviewStore } from '../../core/storage/review-store.js';
import { TerminalFormatters } from '../formatters.js';

export async function dbStatsCommand(options: { config?: string }): Promise<void> {
  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);

  const stats = dbManager.getStats();
  TerminalFormatters.info(`Database at '${config.databasePath}':\n`);
  console.log(`  File size:            ${stats.dbSizeKilobytes} KB`);
  console.log(`  Total reviews:        ${stats.totalReviews}`);
  console.log(`  Triaged reviews:      ${stats.triagedReviews}`);
  console.log(`  Total incidents:      ${stats.totalIncidents}`);
  console.log(`  Active incidents:     ${stats.activeIncidents}`);
  console.log(`  Alerts dispatched:    ${stats.alertsDispatched}\n`);

  dbManager.close();
}

export async function dbCleanCommand(options: { config?: string; days?: string }): Promise<void> {
  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);
  const reviewStore = new ReviewStore(dbManager);

  const days = options.days ? parseInt(options.days, 10) : 60;
  TerminalFormatters.info(`Pruning reviews older than ${days} days...`);

  const deleted = reviewStore.pruneReviewsOlderThan(days);
  TerminalFormatters.success(`Deleted ${deleted} old review records.`);

  dbManager.close();
}

export async function dbExportCommand(options: {
  config?: string;
  format?: 'json' | 'csv';
  output?: string;
}): Promise<void> {
  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);
  const reviewStore = new ReviewStore(dbManager);

  const format = options.format || 'json';
  TerminalFormatters.info(`Exporting database reviews to ${format.toUpperCase()}...`);

  const data = reviewStore.exportReviews(format);

  if (options.output) {
    const outPath = path.resolve(options.output);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, data, 'utf8');
    TerminalFormatters.success(`Export written to ${outPath}`);
  } else {
    console.log(data);
  }

  dbManager.close();
}
