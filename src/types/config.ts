import { z } from 'zod';

export const MonitoredAppSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  appId: z.string().min(1),
  name: z.string().min(1),
  countries: z.array(z.string().min(2)).default(['us']),
  spikeThreshold: z.number().int().positive().optional(),
  windowMinutes: z.number().int().positive().optional(),
});

export type MonitoredApp = z.infer<typeof MonitoredAppSchema>;

export const ClassifierConfigSchema = z.object({
  provider: z.enum(['local', 'anthropic', 'openai', 'gemini']).default('local'),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().positive().default(400),
  temperature: z.number().min(0).max(1).default(0.1),
});

export type ClassifierConfig = z.infer<typeof ClassifierConfigSchema>;

export const DetectionConfigSchema = z.object({
  windowMinutes: z.number().int().positive().default(60),
  spikeThreshold: z.number().int().positive().default(3),
  cooldownMinutes: z.number().int().positive().default(60),
  minSeverity: z.enum(['P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW']).default('P1_CRITICAL'),
});

export type DetectionConfig = z.infer<typeof DetectionConfigSchema>;

export const SlackAlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  webhookUrl: z.string().optional(),
  channel: z.string().optional(),
});
export type SlackAlertConfig = z.infer<typeof SlackAlertConfigSchema>;

export const TelegramAlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().optional(),
  chatId: z.string().optional(),
});
export type TelegramAlertConfig = z.infer<typeof TelegramAlertConfigSchema>;

export const WebhookAlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().optional(),
  secret: z.string().optional(),
});
export type WebhookAlertConfig = z.infer<typeof WebhookAlertConfigSchema>;

export const AlertsConfigSchema = z.object({
  slack: SlackAlertConfigSchema.optional(),
  telegram: TelegramAlertConfigSchema.optional(),
  webhook: WebhookAlertConfigSchema.optional(),
});

export type AlertsConfig = z.infer<typeof AlertsConfigSchema>;

export const ServerConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().positive().default(3456),
  host: z.string().default('0.0.0.0'),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export const AppSentinelConfigSchema = z.object({
  pollIntervalMinutes: z.number().int().positive().default(15),
  databasePath: z.string().default('./data/appsentinel.db'),
  server: ServerConfigSchema.default({ enabled: false, port: 3456, host: '0.0.0.0' }),
  classifier: ClassifierConfigSchema.default({
    provider: 'local',
    maxTokens: 400,
    temperature: 0.1,
  }),
  detection: DetectionConfigSchema.default({
    windowMinutes: 60,
    spikeThreshold: 3,
    cooldownMinutes: 60,
    minSeverity: 'P1_CRITICAL',
  }),
  alerts: AlertsConfigSchema.default({}),
  apps: z.array(MonitoredAppSchema).default([]),
});

export type AppSentinelConfig = z.infer<typeof AppSentinelConfigSchema>;
