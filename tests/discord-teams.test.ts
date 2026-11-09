import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscordAlertChannel } from '../src/core/alerts/discord.js';
import { TeamsAlertChannel } from '../src/core/alerts/teams.js';
import type { IncidentCluster } from '../src/types/incident.js';

describe('Discord & Teams Alert Adapters', () => {
  const cluster: IncidentCluster = {
    id: 'cluster_disc_test',
    appId: 'com.game.racing',
    appName: 'Racing 3D',
    platform: 'android',
    category: 'CRASH',
    subsystem: 'GPU_RENDER',
    suggestedMitigation: 'Inspect Vulkan shader compilation on Adreno 740.',
    appVersion: '2.0.4',
    deviceModels: ['Samsung Galaxy S23 Ultra'],
    osVersions: ['Android 14'],
    reviewCount: 5,
    firstSeenAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    severity: 'P1_CRITICAL',
    rootCauseSummary: 'Instant black screen and crash on launch on Galaxy S23.',
    sampleReviews: [],
  };

  it('formats Discord payload with red embed and subsystem fields', () => {
    const channel = new DiscordAlertChannel();
    const payload = channel.formatDiscordPayload(cluster, 'new_incident') as {
      embeds: Array<{ color: number; fields: Array<{ name: string; value: string }> }>;
    };

    assert.equal(payload.embeds[0].color, 0xed4245);
    const subField = payload.embeds[0].fields.find((f) => f.name === 'Subsystem Area');
    assert.ok(subField?.value.includes('GPU_RENDER'));
    const mitField = payload.embeds[0].fields.find((f) => f.name === 'Suggested Action & Mitigation');
    assert.ok(mitField?.value.includes('Vulkan shader'));
  });

  it('formats Teams MessageCard with themeColor and facts', () => {
    const channel = new TeamsAlertChannel();
    const payload = channel.formatTeamsPayload(cluster, 'new_incident') as {
      themeColor: string;
      sections: Array<{ facts: Array<{ name: string; value: string }> }>;
    };

    assert.equal(payload.themeColor, 'FF0000');
    const facts = payload.sections[0].facts;
    assert.ok(facts.some((f) => f.name === 'Subsystem' && f.value === 'GPU_RENDER'));
    assert.ok(facts.some((f) => f.name === 'Suggested Mitigation' && f.value.includes('Vulkan shader')));
  });
});
