import { XMLParser } from 'fast-xml-parser';
import type { MonitoredApp } from '../../types/config.js';
import type { RawReview } from '../../types/review.js';
import { ReviewStore } from '../storage/review-store.js';
import type { ReviewFetcher } from './base.js';

interface AppleFeedEntry {
  id?: { label?: string };
  title?: { label?: string };
  content?: { label?: string };
  'im:rating'?: { label?: string };
  'im:version'?: { label?: string };
  'im:voteCount'?: { label?: string };
  author?: { name?: { label?: string } };
  updated?: { label?: string };
  link?: { attributes?: { href?: string } };
}

export class AppStoreFetcher implements ReviewFetcher {
  public readonly platform = 'ios' as const;
  private userAgent = 'AppSentinel/1.0 (+https://github.com/alexandrmotologa/appsentinel)';
  private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  public async fetchReviews(app: MonitoredApp): Promise<RawReview[]> {
    if (app.platform !== 'ios') {
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
        // Log country fetch failure and proceed with other countries
        console.warn(`[AppStoreFetcher] Warning: failed to fetch reviews for ${app.name} in country '${country}':`, err instanceof Error ? err.message : String(err));
      }
    }

    return allReviews;
  }

  private async fetchCountryReviews(app: MonitoredApp, country: string, page: number = 1): Promise<RawReview[]> {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${app.appId}/sortBy=mostRecent/json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/xml, application/xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 404) {
          // App might not have reviews in this storefront
          return [];
        }
        throw new Error(`HTTP ${response.status} from App Store RSS (${url})`);
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (contentType.includes('application/json') || text.trim().startsWith('{')) {
        return this.parseJsonResponse(text, app, country);
      } else {
        return this.parseXmlResponse(text, app, country);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private parseJsonResponse(jsonText: string, app: MonitoredApp, country: string): RawReview[] {
    try {
      const data = JSON.parse(jsonText);
      const rawEntries = data?.feed?.entry;

      if (!rawEntries) {
        return [];
      }

      const entries: AppleFeedEntry[] = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
      const reviews: RawReview[] = [];

      for (const entry of entries) {
        // Apple feed's first item is sometimes the application definition, not a user review
        if (!entry['im:rating'] || !entry['im:rating'].label) {
          continue;
        }

        const externalId = entry.id?.label || `ios_${Date.now()}_${Math.random()}`;
        const rating = parseInt(entry['im:rating'].label, 10) || 1;
        const title = entry.title?.label || '';
        const content = entry.content?.label || '';
        const author = entry.author?.name?.label || 'Anonymous';
        const version = entry['im:version']?.label || null;
        const updated = entry.updated?.label || new Date().toISOString();
        const voteCount = entry['im:voteCount']?.label ? parseInt(entry['im:voteCount'].label, 10) : 0;
        const link = entry.link?.attributes?.href;

        const fingerprint = ReviewStore.generateFingerprint('ios', app.appId, externalId);

        reviews.push({
          id: externalId,
          fingerprint,
          appId: app.appId,
          appName: app.name,
          platform: 'ios',
          country,
          author,
          rating,
          title,
          content,
          version,
          date: new Date(updated).toISOString(),
          voteCount,
          url: link,
        });
      }

      return reviews;
    } catch (err) {
      console.warn(`[AppStoreFetcher] Error parsing JSON for app ${app.appId}:`, err);
      return [];
    }
  }

  private parseXmlResponse(xmlText: string, app: MonitoredApp, country: string): RawReview[] {
    try {
      const parsed = this.xmlParser.parse(xmlText);
      const feed = parsed?.feed;
      if (!feed || !feed.entry) {
        return [];
      }

      const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
      const reviews: RawReview[] = [];

      for (const entry of entries) {
        const ratingVal = entry['im:rating'] ?? entry.rating;
        if (!ratingVal) continue;

        const externalId = String(entry.id?.['#text'] || entry.id || `ios_${Date.now()}`);
        const rating = parseInt(String(ratingVal), 10) || 1;
        const title = String(entry.title?.['#text'] || entry.title || '');
        const content = String(entry.content?.['#text'] || entry.content || '');
        const author = String(entry.author?.name?.['#text'] || entry.author?.name || 'Anonymous');
        const version = entry['im:version'] ? String(entry['im:version']) : null;
        const updated = entry.updated ? String(entry.updated) : new Date().toISOString();

        const fingerprint = ReviewStore.generateFingerprint('ios', app.appId, externalId);

        reviews.push({
          id: externalId,
          fingerprint,
          appId: app.appId,
          appName: app.name,
          platform: 'ios',
          country,
          author,
          rating,
          title,
          content,
          version,
          date: new Date(updated).toISOString(),
        });
      }

      return reviews;
    } catch (err) {
      console.warn(`[AppStoreFetcher] Error parsing XML for app ${app.appId}:`, err);
      return [];
    }
  }
}
