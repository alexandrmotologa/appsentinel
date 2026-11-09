export type ReviewPlatform = 'ios' | 'android';

export type IncidentCategory =
  | 'CRASH'
  | 'IN_APP_PURCHASE_FAIL'
  | 'ACCOUNT_LOGIN'
  | 'AD_BLOCKED'
  | 'GAMEPLAY_BUG'
  | 'PERFORMANCE_LAG'
  | 'NETWORK_ERROR'
  | 'UI_GLITCH'
  | 'OTHER';

export type SubsystemArea =
  | 'NETWORK_SSL'
  | 'STOREKIT_BILLING'
  | 'AUTH_SESSION'
  | 'GPU_RENDER'
  | 'STORAGE_IO'
  | 'PUSH_NOTIFICATIONS'
  | 'MEMORY_LEAK'
  | 'APP_LIFECYCLE'
  | 'UNKNOWN';

export type IncidentSeverity =
  | 'P1_CRITICAL'
  | 'P2_HIGH'
  | 'P3_MEDIUM'
  | 'P4_LOW';

export interface RawReview {
  id: string;
  fingerprint: string;
  appId: string;
  appName: string;
  platform: ReviewPlatform;
  country: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  version: string | null;
  date: string;
  voteCount?: number;
  url?: string;
  rawJson?: string;
}

export interface TriageResult {
  category: IncidentCategory;
  severity: IncidentSeverity;
  subsystem?: SubsystemArea;
  suggestedMitigation?: string;
  deviceModel: string | null;
  osVersion: string | null;
  extractedVersion: string | null;
  rootCauseSummary: string;
  actionableBugReport: boolean;
  sentimentScore: number;
  keywords: string[];
}

export interface TriagedReview extends RawReview {
  triage: TriageResult;
  triagedAt: string;
  classifierProvider: string;
}
