import type { RawReview, TriageResult } from '../../types/review.js';
import type { ReviewClassifier } from './base.js';
import { TriageResultSchema } from './schema.js';

export class OpenAIClassifier implements ReviewClassifier {
  public readonly name = 'openai-gpt4o-mini';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY or configure classifier.apiKey.');
    }
  }

  public async triage(review: RawReview): Promise<TriageResult> {
    const systemPrompt = `You are a mobile incident triage engineer analyzing a customer review.
Output JSON only with keys: category, severity, deviceModel, osVersion, extractedVersion, rootCauseSummary, actionableBugReport, sentimentScore, keywords.
category must be one of: CRASH, IN_APP_PURCHASE_FAIL, ACCOUNT_LOGIN, AD_BLOCKED, GAMEPLAY_BUG, PERFORMANCE_LAG, NETWORK_ERROR, UI_GLITCH, OTHER.
severity must be one of: P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW.`;

    const userPrompt = `App: ${review.appName} (${review.platform})
Version: ${review.version || 'Unknown'}
Rating: ${review.rating} / 5
Title: ${review.title}
Text: ${review.content}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 400,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const contentText = data?.choices?.[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(contentText);
      return TriageResultSchema.parse(parsed);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
