import gplay from 'google-play-scraper';

export interface StoreSearchResult {
  platform: 'ios' | 'android';
  appId: string;
  name: string;
  developer: string;
  iconUrl?: string;
  rating?: number;
  url?: string;
  category?: string;
}

export class StoreSearcher {
  public static async searchAppStore(query: string, country: string = 'us', limit: number = 5): Promise<StoreSearchResult[]> {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=${limit}&country=${country}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'AppSentinel-Search/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`iTunes Search API error HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        results?: Array<{
          trackId: number;
          trackName: string;
          artistName: string;
          artworkUrl100?: string;
          averageUserRating?: number;
          trackViewUrl?: string;
          primaryGenreName?: string;
        }>;
      };

      return (data.results || []).map((r) => ({
        platform: 'ios' as const,
        appId: String(r.trackId),
        name: r.trackName,
        developer: r.artistName,
        iconUrl: r.artworkUrl100,
        rating: r.averageUserRating ? Number(r.averageUserRating.toFixed(1)) : undefined,
        url: r.trackViewUrl,
        category: r.primaryGenreName,
      }));
    } catch (err) {
      clearTimeout(timeout);
      console.warn(`[StoreSearcher] iOS search failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  public static async searchGooglePlay(query: string, country: string = 'us', limit: number = 5): Promise<StoreSearchResult[]> {
    try {
      const scraper = (gplay as unknown as { default?: typeof gplay }).default || gplay;
      const searchFn = (scraper as unknown as { search: (opts: Record<string, unknown>) => Promise<unknown> }).search;

      const results = await searchFn({
        term: query,
        num: limit,
        country: country.toLowerCase(),
        lang: 'en',
      });

      const list = Array.isArray(results) ? results : [];

      return list.map((r: Record<string, unknown>) => ({
        platform: 'android' as const,
        appId: String(r.appId || ''),
        name: String(r.title || ''),
        developer: String(r.developer || ''),
        iconUrl: typeof r.icon === 'string' ? r.icon : undefined,
        rating: typeof r.score === 'number' ? Number(r.score.toFixed(1)) : undefined,
        url: typeof r.url === 'string' ? r.url : undefined,
        category: typeof r.genre === 'string' ? r.genre : undefined,
      }));
    } catch (err) {
      console.warn(`[StoreSearcher] Google Play search failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  public static async searchAll(query: string, country: string = 'us', limit: number = 5): Promise<StoreSearchResult[]> {
    const [iosResults, androidResults] = await Promise.all([
      StoreSearcher.searchAppStore(query, country, limit),
      StoreSearcher.searchGooglePlay(query, country, limit),
    ]);

    return [...iosResults, ...androidResults];
  }
}
