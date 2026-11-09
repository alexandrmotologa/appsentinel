import gplay from 'google-play-scraper';
import type { MonitoredApp } from '../../types/config.js';
import type { RawReview } from '../../types/review.js';
import { ReviewStore } from '../storage/review-store.js';
import type { ReviewFetcher } from './base.js';

interface GPlayReviewItem {
  id: string;
  userName?: string;
  score?: number;
  title?: string;
  text?: string;
  version?: string;
  date?: string;
  url?: string;
  thumbsUp?: number;
}

export class GooglePlayFetcher implements ReviewFetcher {
  public readonly platform = 'android' as const;

  public async fetchReviews(app: MonitoredApp): Promise<RawReview[]> {
    if (app.platform !== 'android') {
      return [];
    }

    const allReviews: RawReview[] = [];
    const seenFingerprints = new Set<string>();
    const countries = app.countries && app.countries.length > 0 ? app.countries : ['us'];

    for (const country of countries) {
      try {
        const countryReviews = await this.fetchCountryReviews(app, country);
        for (const review of countryReviews) {
          if (!seenFingerprints.has(review.fingerprint)) {
            seenFingerprints.add(review.fingerprint);
            allReviews.push(review);
          }
        }
      } catch (err) {
        console.warn(
          `[GooglePlayFetcher] Warning: failed to fetch reviews for ${app.name} (${app.appId}) in country '${country}':`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return allReviews;
  }

  private async fetchCountryReviews(
    app: MonitoredApp,
    country: string,
    num: number = 50
  ): Promise<RawReview[]> {
    try {
      // In google-play-scraper v10+, reviews returns { data: [...], nextPaginationToken: ... }
      const scraper = (gplay as unknown as { default?: typeof gplay }).default || gplay;
      const sortOption = ((scraper as Record<string, unknown>).sort as Record<string, number>)?.NEWEST ?? 2;
      const response = await (scraper as unknown as { reviews: (opts: Record<string, unknown>) => Promise<unknown> }).reviews({
        appId: app.appId,
        sort: sortOption,
        num,
        country: country.toLowerCase(),
        lang: 'en',
      });

      const rawList: GPlayReviewItem[] = Array.isArray(response)
        ? response
        : (response as { data?: GPlayReviewItem[] }).data || [];

      const reviews: RawReview[] = [];

      for (const item of rawList) {
        if (!item.id) continue;

        const rating = typeof item.score === 'number' ? item.score : 1;
        const content = item.text || '';
        const title = item.title || content.slice(0, 60);
        const author = item.userName || 'Anonymous';
        const version = item.version || null;
        const date = item.date ? new Date(item.date).toISOString() : new Date().toISOString();
        const fingerprint = ReviewStore.generateFingerprint('android', app.appId, item.id);

        reviews.push({
          id: item.id,
          fingerprint,
          appId: app.appId,
          appName: app.name,
          platform: 'android',
          country,
          author,
          rating,
          title,
          content,
          version,
          date,
          voteCount: item.thumbsUp ?? 0,
          url: item.url,
        });
      }

      return reviews;
    } catch (err) {
      throw new Error(`Google Play fetch failed for ${app.appId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
