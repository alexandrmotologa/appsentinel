import type { RawReview, TriageResult } from '../../types/review.js';

export interface ReviewClassifier {
  readonly name: string;
  triage(review: RawReview): Promise<TriageResult>;
}
