import fs from 'node:fs';
import path from 'node:path';
import type { RawReview } from '../../types/review.js';
import { ReviewStore } from '../storage/review-store.js';

export interface FixtureScenarioOptions {
  appId?: string;
  appName?: string;
  platform?: 'ios' | 'android';
  version?: string;
  count?: number;
  timeWindowMinutes?: number;
}

export class FixtureLoader {
  public static loadFromFile(filePath: string): RawReview[] {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Fixture file not found: ${resolved}`);
    }

    const content = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list.map((item, idx) => {
      const platform = (item.platform as 'ios' | 'android') || 'ios';
      const appId = item.appId || 'com.example.app';
      const id = item.id || `fixture_${Date.now()}_${idx}`;
      const fingerprint =
        item.fingerprint || ReviewStore.generateFingerprint(platform, appId, id);

      return {
        id,
        fingerprint,
        appId,
        appName: item.appName || 'Example App',
        platform,
        country: item.country || 'us',
        author: item.author || `User${idx + 1}`,
        rating: typeof item.rating === 'number' ? item.rating : 1,
        title: item.title || 'Review Title',
        content: item.content || item.text || '',
        version: item.version || '1.0.0',
        date: item.date || new Date().toISOString(),
        voteCount: item.voteCount ?? 0,
        url: item.url,
      };
    });
  }

  public static generateCrashCascade(options: FixtureScenarioOptions = {}): RawReview[] {
    const appId = options.appId || 'com.superstudio.battlequest';
    const appName = options.appName || 'Battle Quest';
    const platform = options.platform || 'ios';
    const version = options.version || '4.2.0';
    const count = options.count ?? 5;
    const windowMinutes = options.timeWindowMinutes ?? 45;

    const crashReports = [
      {
        title: 'Crashes on launch immediately',
        content: `Ever since updating to ${version}, the game freezes at the splash screen and crashes to home screen. iPhone 15 Pro on iOS 17.5. Unplayable!`,
        rating: 1,
      },
      {
        title: 'Cannot open app anymore',
        content: `Instant crash upon tap. Worked fine on ${version.split('.')[0]}.1.9, now it crashes instantly. Using iPhone 14 Pro Max.`,
        rating: 1,
      },
      {
        title: 'Black screen then crash',
        content: `Screen turns black for 2 seconds and crashes immediately. Started right after today's update to ${version}.`,
        rating: 1,
      },
      {
        title: 'Crash loop after login',
        content: `Game loads until GameCenter sign-in, then hard crashes. Please hotfix this ${version} release ASAP!`,
        rating: 1,
      },
      {
        title: 'Broken update',
        content: `Crashes every single time on startup. Downgrade or fix! iPhone 13 mini running iOS 17.4.`,
        rating: 1,
      },
      {
        title: 'Another crash',
        content: `Fatal exception on startup screen. Was working 1 hour ago before updating.`,
        rating: 1,
      },
    ];

    const now = Date.now();
    const reviews: RawReview[] = [];

    for (let i = 0; i < count; i++) {
      const template = crashReports[i % crashReports.length];
      const offsetMs = Math.round((windowMinutes * 60 * 1000 * (i + 1)) / (count + 1));
      const date = new Date(now - (windowMinutes * 60 * 1000 - offsetMs)).toISOString();
      const id = `crash_sim_${now}_${i + 1}`;
      const fingerprint = ReviewStore.generateFingerprint(platform, appId, id);

      reviews.push({
        id,
        fingerprint,
        appId,
        appName,
        platform,
        country: 'us',
        author: `AffectedGamer_${i + 1}`,
        rating: template.rating,
        title: template.title,
        content: template.content,
        version,
        date,
      });
    }

    return reviews;
  }

  public static generatePaymentCascade(options: FixtureScenarioOptions = {}): RawReview[] {
    const appId = options.appId || 'com.superstudio.battlequest';
    const appName = options.appName || 'Battle Quest';
    const platform = options.platform || 'android';
    const version = options.version || '3.8.0';
    const count = options.count ?? 4;

    const paymentReports = [
      {
        title: 'Charged but got nothing',
        content: `I bought the 500 gems pack for $9.99, Google Play charged my card, but the game gave an error 'transaction receipt invalid'. Refund or give items!`,
        rating: 1,
      },
      {
        title: 'Payment deducted without coins',
        content: `Billing failed error 1004. Card was debited, no coins added to my balance. Samsung Galaxy S23.`,
        rating: 1,
      },
      {
        title: 'Season pass unlock failed',
        content: `Purchased battle pass, money was taken, but the pass is still locked in-game. Terrible support!`,
        rating: 1,
      },
      {
        title: 'Store purchases broken',
        content: `In-app store freezes during Google Play billing sheet. Charged twice and nothing received.`,
        rating: 1,
      },
    ];

    const now = Date.now();
    const reviews: RawReview[] = [];

    for (let i = 0; i < count; i++) {
      const template = paymentReports[i % paymentReports.length];
      const date = new Date(now - (count - i) * 10 * 60 * 1000).toISOString();
      const id = `payment_sim_${now}_${i + 1}`;
      const fingerprint = ReviewStore.generateFingerprint(platform, appId, id);

      reviews.push({
        id,
        fingerprint,
        appId,
        appName,
        platform,
        country: 'us',
        author: `Payer_${i + 1}`,
        rating: template.rating,
        title: template.title,
        content: template.content,
        version,
        date,
      });
    }

    return reviews;
  }
}
