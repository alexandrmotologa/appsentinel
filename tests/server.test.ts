import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../src/core/storage/database.js';
import { IncidentStore } from '../src/core/storage/incident-store.js';
import { EmbeddedServer } from '../src/core/server/server.js';

describe('Embedded HTTP Server', () => {
  let dbManager: DatabaseManager;
  let incidentStore: IncidentStore;
  let server: EmbeddedServer;
  const testPort = 39871;

  before(async () => {
    dbManager = new DatabaseManager(':memory:');
    incidentStore = new IncidentStore(dbManager);
    server = new EmbeddedServer(dbManager, incidentStore);
    await server.listen(testPort, '127.0.0.1');
  });

  after(async () => {
    await server.close();
    dbManager.close();
  });

  it('serves /healthz with 200 OK and healthy database status', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/healthz`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.database, 'healthy');
    assert.ok(typeof data.uptimeSeconds === 'number');
  });

  it('serves /metrics with Prometheus text metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/metrics`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('appsentinel_uptime_seconds'));
    assert.ok(text.includes('appsentinel_reviews_total'));
  });

  it('serves /dashboard with HTML markup', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('AppSentinel Monitor'));
    assert.ok(html.includes('Active Incident Clusters'));
  });
});
