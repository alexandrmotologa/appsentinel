import fs from 'node:fs';
import path from 'node:path';
import { ConfigLoader } from '../../core/config-loader.js';
import { ReportGenerator } from '../../core/reporting/report-generator.js';
import { DatabaseManager } from '../../core/storage/database.js';
import { IncidentStore } from '../../core/storage/incident-store.js';
import { TerminalFormatters } from '../formatters.js';

export async function reportCommand(options: {
  config?: string;
  days?: string;
  format?: 'markdown' | 'json' | 'html';
  output?: string;
}): Promise<void> {
  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);
  const incidentStore = new IncidentStore(dbManager);
  const generator = new ReportGenerator(incidentStore, dbManager);

  const days = options.days ? parseInt(options.days, 10) : 7;
  const format = options.format || 'markdown';

  TerminalFormatters.info(`Generating ${format.toUpperCase()} incident report for past ${days} days...`);

  const report = generator.generateReport({ days, format });

  if (options.output) {
    const outPath = path.resolve(options.output);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, report, 'utf8');
    TerminalFormatters.success(`Report written to ${outPath}`);
  } else {
    console.log('\n' + report);
  }

  dbManager.close();
}
