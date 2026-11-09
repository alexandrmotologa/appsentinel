import http from 'node:http';
import type { DatabaseManager } from '../storage/database.js';
import type { IncidentStore } from '../storage/incident-store.js';
import { DashboardRenderer } from './dashboard.js';
import { PrometheusMetrics } from './metrics.js';

export class EmbeddedServer {
  private server: http.Server | null = null;
  private dbManager: DatabaseManager;
  private incidentStore: IncidentStore;
  private metrics: PrometheusMetrics;
  private startTime: number;

  constructor(dbManager: DatabaseManager, incidentStore: IncidentStore) {
    this.dbManager = dbManager;
    this.incidentStore = incidentStore;
    this.metrics = new PrometheusMetrics(dbManager);
    this.startTime = Date.now();
  }

  public listen(port: number = 3456, host: string = '0.0.0.0'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        try {
          if (pathname === '/healthz') {
            const uptime = Math.round((Date.now() - this.startTime) / 1000);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                status: 'ok',
                uptimeSeconds: uptime,
                database: 'healthy',
                timestamp: new Date().toISOString(),
              })
            );
            return;
          }

          if (pathname === '/metrics') {
            const output = this.metrics.exportMetrics();
            res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
            res.end(output);
            return;
          }

          if (pathname === '/api/incidents') {
            const incidents = this.incidentStore.listIncidents({ limit: 50 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify(
                incidents.map((inc) => ({
                  ...inc,
                  deviceModels: JSON.parse(inc.deviceModelsJson || '[]'),
                  osVersions: JSON.parse(inc.osVersionsJson || '[]'),
                })),
                null,
                2
              )
            );
            return;
          }

          if (pathname === '/api/stats') {
            const stats = this.dbManager.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats, null, 2));
            return;
          }

          if (pathname === '/' || pathname === '/dashboard') {
            const uptime = Math.round((Date.now() - this.startTime) / 1000);
            const html = DashboardRenderer.renderHtml(this.dbManager, this.incidentStore, uptime);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Internal Server Error',
              message: err instanceof Error ? err.message : String(err),
            })
          );
        }
      });

      this.server.on('error', (err) => reject(err));
      this.server.listen(port, host, () => {
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
