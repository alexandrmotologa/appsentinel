import { ConfigLoader } from '../../core/config-loader.js';
import { EmbeddedServer } from '../../core/server/server.js';
import { DatabaseManager } from '../../core/storage/database.js';
import { IncidentStore } from '../../core/storage/incident-store.js';
import { TerminalFormatters } from '../formatters.js';

export async function serveCommand(options: {
  config?: string;
  port?: string;
  host?: string;
}): Promise<void> {
  TerminalFormatters.banner();

  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);
  const incidentStore = new IncidentStore(dbManager);

  const port = options.port ? parseInt(options.port, 10) : config.server?.port || 3456;
  const host = options.host || config.server?.host || '0.0.0.0';

  const server = new EmbeddedServer(dbManager, incidentStore);
  await server.listen(port, host);

  TerminalFormatters.success(`AppSentinel HTTP Server running on http://${host}:${port}`);
  console.log(`  Dashboard:  http://localhost:${port}/`);
  console.log(`  Health:     http://localhost:${port}/healthz`);
  console.log(`  Metrics:    http://localhost:${port}/metrics`);
  console.log(`  Incidents:  http://localhost:${port}/api/incidents`);
  console.log(`  Stats:      http://localhost:${port}/api/stats\n`);
  TerminalFormatters.info('Press Ctrl+C to terminate.');

  const shutdown = async () => {
    TerminalFormatters.warn('\nStopping HTTP server...');
    await server.close();
    dbManager.close();
    TerminalFormatters.success('Server stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await new Promise(() => {});
}
