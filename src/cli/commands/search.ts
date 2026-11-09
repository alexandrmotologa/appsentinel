import { StoreSearcher } from '../../core/fetchers/store-search.js';
import { TerminalFormatters } from '../formatters.js';

export async function searchCommand(
  query: string,
  options: {
    platform?: 'ios' | 'android' | 'all';
    country?: string;
    limit?: string;
  }
): Promise<void> {
  const platform = options.platform || 'all';
  const country = options.country || 'us';
  const limit = options.limit ? parseInt(options.limit, 10) : 5;

  TerminalFormatters.info(`Searching for "${query}" on ${platform.toUpperCase()} (${country.toUpperCase()})...\n`);

  let results: Awaited<ReturnType<typeof StoreSearcher.searchAll>> = [];

  if (platform === 'ios') {
    results = await StoreSearcher.searchAppStore(query, country, limit);
  } else if (platform === 'android') {
    results = await StoreSearcher.searchGooglePlay(query, country, limit);
  } else {
    results = await StoreSearcher.searchAll(query, country, limit);
  }

  if (results.length === 0) {
    TerminalFormatters.warn(`No apps found matching "${query}". Try another search term.`);
    return;
  }

  TerminalFormatters.success(`Found ${results.length} matching applications:\n`);

  for (const r of results) {
    const platBadge = r.platform === 'ios' ? 'iOS    ' : 'Android';
    const ratingStr = r.rating ? `⭐ ${r.rating}` : 'No rating';
    const catStr = r.category ? `[${r.category}]` : '';

    console.log(`  [${platBadge}] ${r.name} ${catStr}`);
    console.log(`    App ID:    ${r.appId}`);
    console.log(`    Developer: ${r.developer}`);
    console.log(`    Rating:    ${ratingStr}`);
    if (r.url) {
      console.log(`    Store URL: ${r.url}`);
    }
    console.log('');
  }

  console.log(`  Quick setup: run \`appsentinel add ${results[0].platform} ${results[0].appId} --name "${results[0].name.replace(/"/g, '')}"\` to monitor.`);
}
