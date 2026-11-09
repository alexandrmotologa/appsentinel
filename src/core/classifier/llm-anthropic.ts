import type { RawReview, TriageResult } from '../../types/review.js';
import type { ReviewClassifier } from './base.js';
import { TriageResultSchema } from './schema.js';

export class AnthropicClassifier implements ReviewClassifier {
  public readonly name = 'anthropic-haiku';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-3-5-haiku-latest') {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = model;
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY or configure classifier.apiKey.');
    }
  }

  public async triage(review: RawReview): Promise<TriageResult> {
    const prompt = `You are a mobile incident triage engineer analyzing a 1-star or 2-star customer review.
Analyze the review and return a strictly valid JSON object matching this schema:
{
  "category": "CRASH" | "IN_APP_PURCHASE_FAIL" | "ACCOUNT_LOGIN" | "AD_BLOCKED" | "GAMEPLAY_BUG" | "PERFORMANCE_LAG" | "NETWORK_ERROR" | "UI_GLITCH" | "OTHER",
  "severity": "P1_CRITICAL" | "P2_HIGH" | "P3_MEDIUM" | "P4_LOW",
  "deviceModel": string or null (e.g. "iPhone 15 Pro", "Samsung S23", "Pixel 8"),
  "osVersion": string or null (e.g. "iOS 17.4", "Android 14"),
  "extractedVersion": string or null,
  "rootCauseSummary": "1-2 concise factual sentences describing what broke and why",
  "actionableBugReport": boolean,
  "sentimentScore": number between -1.0 and 1.0,
  "keywords": ["keyword1", "keyword2"]
}

App: ${review.appName} (${review.platform})
Reported App Version: ${review.version || 'Unknown'}
Rating: ${review.rating} / 5
Review Title: ${review.title}
Review Content: ${review.content}

Return ONLY the raw JSON object. Do not enclose in markdown code blocks.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      const contentText = data?.content?.[0]?.text?.trim() || '{}';
      const cleanJson = contentText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

      const parsed = JSON.parse(cleanJson);
      return TriageResultSchema.parse(parsed);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
