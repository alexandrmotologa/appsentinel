import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StoreSearcher } from '../src/core/fetchers/store-search.js';

describe('Store Searcher Layer', () => {
  it('searches Apple App Store and returns structured results with trackId', async () => {
    const results = await StoreSearcher.searchAppStore('Subway Surfers', 'us', 2);
    assert.ok(Array.isArray(results));
    if (results.length > 0) {
      const first = results[0];
      assert.equal(first.platform, 'ios');
      assert.ok(first.appId.length > 0);
      assert.ok(first.name.length > 0);
    }
  });

  it('searches Google Play and returns results with bundle ID', async () => {
    const results = await StoreSearcher.searchGooglePlay('Spotify', 'us', 2);
    assert.ok(Array.isArray(results));
    if (results.length > 0) {
      const first = results[0];
      assert.equal(first.platform, 'android');
      assert.ok(first.appId.includes('.'));
    }
  });
});
