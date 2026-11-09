import { ConfigLoader } from '../../core/config-loader.js';
import { DeveloperReplyGenerator, type ReplyOptions } from '../../core/support/reply-generator.js';
import { DatabaseManager } from '../../core/storage/database.js';
import { IncidentStore } from '../../core/storage/incident-store.js';
import type { IncidentCluster } from '../../types/incident.js';
import { TerminalFormatters } from '../formatters.js';

export async function draftReplyCommand(
  incidentIdOrText: string,
  options: {
    config?: string;
    lang?: 'en' | 'de' | 'es' | 'fr' | 'ja' | 'pt' | 'ro';
    supportEmail?: string;
    supportUrl?: string;
  }
): Promise<void> {
  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);
  const incidentStore = new IncidentStore(dbManager);

  // Try finding incident by ID or cluster fingerprint
  const incidents = incidentStore.listIncidents({ limit: 100 });
  const found = incidents.find(
    (i) => i.id === incidentIdOrText || i.clusterFingerprint === incidentIdOrText
  );

  let targetCluster: IncidentCluster;

  if (found) {
    targetCluster = {
      id: found.id,
      appId: found.appId,
      appName: found.appName,
      platform: found.platform,
      category: found.category,
      appVersion: found.appVersion,
      deviceModels: JSON.parse(found.deviceModelsJson || '[]'),
      osVersions: JSON.parse(found.osVersionsJson || '[]'),
      reviewCount: found.reviewCount,
      firstSeenAt: found.firstSeenAt,
      lastSeenAt: found.lastSeenAt,
      severity: found.severity,
      rootCauseSummary: found.rootCauseSummary,
      sampleReviews: JSON.parse(found.sampleReviewsJson || '[]'),
    };
  } else {
    // Construct ad-hoc cluster
    targetCluster = {
      id: 'adhoc_incident',
      appId: 'adhoc.app',
      appName: config.apps[0]?.name || 'Mobile App',
      platform: 'ios',
      category: 'CRASH',
      appVersion: 'latest',
      deviceModels: [],
      osVersions: [],
      reviewCount: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      severity: 'P1_CRITICAL',
      rootCauseSummary: incidentIdOrText,
      sampleReviews: [],
    };
  }

  const replyOpts: ReplyOptions = {
    language: options.lang || 'en',
    supportEmail: options.supportEmail,
    supportUrl: options.supportUrl,
  };

  const reply = DeveloperReplyGenerator.generateReply(targetCluster, replyOpts);

  TerminalFormatters.info(
    `Developer Reply Draft [${(options.lang || 'en').toUpperCase()}] for ${targetCluster.appName} (v${targetCluster.appVersion}):\n`
  );
  console.log(`"${reply}"\n`);
  TerminalFormatters.success('Copy and paste this message into App Store Connect or Google Play Console.');

  dbManager.close();
}
