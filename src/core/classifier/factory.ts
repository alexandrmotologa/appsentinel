import type { ClassifierConfig } from '../../types/config.js';
import type { RawReview, TriageResult } from '../../types/review.js';
import { AnthropicClassifier } from './llm-anthropic.js';
import { GeminiClassifier } from './llm-gemini.js';
import { LocalHeuristicClassifier } from './heuristics.js';
import { OpenAIClassifier } from './llm-openai.js';
import type { ReviewClassifier } from './base.js';

export class FallbackClassifier implements ReviewClassifier {
  public readonly name: string;
  private primary: ReviewClassifier;
  private fallback: LocalHeuristicClassifier;

  constructor(primary: ReviewClassifier) {
    this.primary = primary;
    this.fallback = new LocalHeuristicClassifier();
    this.name = `${primary.name}+fallback`;
  }

  public async triage(review: RawReview): Promise<TriageResult> {
    try {
      return await this.primary.triage(review);
    } catch (err) {
      console.warn(
        `[Classifier] Primary classifier '${this.primary.name}' failed. Falling back to local heuristics:`,
        err instanceof Error ? err.message : String(err)
      );
      return await this.fallback.triage(review);
    }
  }
}

export class ClassifierFactory {
  public static create(config?: Partial<ClassifierConfig>): ReviewClassifier {
    const provider = config?.provider || 'local';
    const fallback = new LocalHeuristicClassifier();

    switch (provider) {
      case 'anthropic': {
        const key = config?.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) {
          console.warn('[ClassifierFactory] ANTHROPIC_API_KEY not found. Using local heuristic classifier.');
          return fallback;
        }
        return new FallbackClassifier(new AnthropicClassifier(key, config?.model));
      }
      case 'openai': {
        const key = config?.apiKey || process.env.OPENAI_API_KEY;
        if (!key) {
          console.warn('[ClassifierFactory] OPENAI_API_KEY not found. Using local heuristic classifier.');
          return fallback;
        }
        return new FallbackClassifier(new OpenAIClassifier(key, config?.model));
      }
      case 'gemini': {
        const key = config?.apiKey || process.env.GEMINI_API_KEY;
        if (!key) {
          console.warn('[ClassifierFactory] GEMINI_API_KEY not found. Using local heuristic classifier.');
          return fallback;
        }
        return new FallbackClassifier(new GeminiClassifier(key, config?.model));
      }
      case 'local':
      default:
        return fallback;
    }
  }
}
