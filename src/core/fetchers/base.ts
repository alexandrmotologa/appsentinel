import type { MonitoredApp } from '../../types/config.js';
import type { RawReview } from '../../types/review.js';

export interface ReviewFetcher {
  readonly platform: 'ios' | 'android';
  fetchReviews(app: MonitoredApp): Promise<RawReview[]>;
}
