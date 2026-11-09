import type { RawReview, TriageResult } from '../../types/review.js';
import type { ReviewClassifier } from './base.js';
import { TriageResultSchema } from './schema.js';

export class GeminiClassifier implements ReviewClassifier {
  public readonly name = 'gemini-flash';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model;
    if (!this.apiKey) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY or configure classifier.apiKey.');
    }
  }

  public async triage(review: RawReview): Promise<TriageResult> {
    const prompt = `You are a mobile incident triage engineer analyzing a customer review.
Analyze the review and return a valid JSON object matching this schema:
{
  "category": "CRASH" | "IN_APP_PURCHASE_FAIL" | "ACCOUNT_LOGIN" | "AD_BLOCKED" | "GAMEPLAY_BUG" | "PERFORMANCE_LAG" | "NETWORK_ERROR" | "UI_GLITCH" | "OTHER",
  "severity": "P1_CRITICAL" | "P2_HIGH" | "P3_MEDIUM" | "P4_LOW",
  "deviceModel": string or null,
  "osVersion": string or null,
  "extractedVersion": string or null,
  "rootCauseSummary": "1-2 concise factual sentences",
  "actionableBugReport": boolean,
  "sentimentScore": number between -1.0 and 1.0,
  "keywords": ["keyword1", "keyword2"]
}

App: ${review.appName} (${review.platform})
App Version: ${review.version || 'Unknown'}
Rating: ${review.rating} / 5
Title: ${review.title}
Review: ${review.content}

Return ONLY raw JSON, no code block markers.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

      const parsed = JSON.parse(cleanJson);
      return TriageResultSchema.parse(parsed);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
