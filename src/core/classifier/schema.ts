import { z } from 'zod';

export const TriageResultSchema = z.object({
  category: z.enum([
    'CRASH',
    'IN_APP_PURCHASE_FAIL',
    'ACCOUNT_LOGIN',
    'AD_BLOCKED',
    'GAMEPLAY_BUG',
    'PERFORMANCE_LAG',
    'NETWORK_ERROR',
    'UI_GLITCH',
    'OTHER',
  ]),
  subsystem: z
    .enum([
      'NETWORK_SSL',
      'STOREKIT_BILLING',
      'AUTH_SESSION',
      'GPU_RENDER',
      'STORAGE_IO',
      'PUSH_NOTIFICATIONS',
      'MEMORY_LEAK',
      'APP_LIFECYCLE',
      'UNKNOWN',
    ])
    .default('UNKNOWN'),
  suggestedMitigation: z.string().default(''),
  severity: z.enum(['P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW']),
  deviceModel: z.string().nullable().default(null),
  osVersion: z.string().nullable().default(null),
  extractedVersion: z.string().nullable().default(null),
  rootCauseSummary: z.string().min(1),
  actionableBugReport: z.boolean().default(true),
  sentimentScore: z.number().min(-1).max(1).default(-0.8),
  keywords: z.array(z.string()).default([]),
});

export type ValidatedTriageResult = z.infer<typeof TriageResultSchema>;
