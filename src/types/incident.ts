import type { IncidentCategory, IncidentSeverity, ReviewPlatform, TriagedReview } from './review.js';

export type IncidentStatus = 'active' | 'cooldown' | 'resolved';

export interface IncidentCluster {
  id: string;
  appId: string;
  appName: string;
  platform: ReviewPlatform;
  category: IncidentCategory;
  appVersion: string;
  deviceModels: string[];
  osVersions: string[];
  reviewCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  severity: IncidentSeverity;
  rootCauseSummary: string;
  sampleReviews: TriagedReview[];
}

export interface IncidentRecord {
  id: string;
  clusterFingerprint: string;
  appId: string;
  appName: string;
  platform: ReviewPlatform;
  category: IncidentCategory;
  appVersion: string;
  severity: IncidentSeverity;
  reviewCount: number;
  status: IncidentStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastAlertAt?: string | null;
  resolvedAt?: string | null;
  rootCauseSummary: string;
  deviceModelsJson: string;
  osVersionsJson: string;
  sampleReviewsJson: string;
}

export interface IncidentAlertRecord {
  id: string;
  incidentId: string;
  channel: string;
  status: 'sent' | 'failed' | 'suppressed';
  error?: string | null;
  payloadJson: string;
  sentAt: string;
}
